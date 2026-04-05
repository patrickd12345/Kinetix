import { execFileSync, execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const _heap = '--max-old-space-size=16384'
if (!/--max-old-space-size=\d+/.test(process.env.NODE_OPTIONS || '')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} ${_heap}`.trim()
}

/**
 * Umbrella checkout: `products/Kinetix/scripts` -> `../../../packages` = Bookiji-inc repo-root `packages/`.
 * Standalone (Vercel): use `../.bookiji-packages` from `scripts/vercel-install.sh`.
 *
 * Do NOT use `isDir(../../../packages)` alone: on Linux that path resolves to `/packages` from
 * `repo/scripts` (three levels up leaves the repo), which can exist on the host and is not the
 * monorepo — local Windows paths look like `.../Bookiji inc/packages` and only that layout should
 * count. We require at least one known package to have `package.json` under the candidate root.
 *
 * When both umbrella `packages/` and `.bookiji-packages/` exist (e.g. after `vercel-install.sh` inside
 * the umbrella), prefer `.bookiji-packages/` so builds match Vercel — otherwise `../../../packages`
 * wins and parity checks never exercise the clone.
 *
 * Builds use `pnpm --filter <name> run build` from the Kinetix root (no per-package `pnpm install`),
 * so the single root install from `vercel-install` / dev is enough and avoids OOM on Windows.
 *
 * On Linux/macOS: `execFileSync('pnpm', argv)` — no `/bin/sh` (avoids ENOENT when cwd is wrong).
 * On Windows: `execSync` + `shell: true` so `pnpm` resolves (pnpm.cmd).
 */
const scriptDir = dirname(fileURLToPath(import.meta.url))
const kinetixRoot = dirname(scriptDir)
const umbrellaPackages = resolve(scriptDir, '../../../packages')
const bookijiPackages = resolve(scriptDir, '../.bookiji-packages')
const names = [
  'ai-core',
  'ai-runtime',
  'persistent-memory-runtime',
  'error-contract',
  'observability',
  'platform-auth',
  'stripe-runtime',
]

function isDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

function hasImporterManifest(pkgDir) {
  try {
    return statSync(join(pkgDir, 'package.json')).isFile()
  } catch {
    return false
  }
}

function bookijiCloneHasPackages() {
  if (!isDir(bookijiPackages)) return false
  return names.every((n) => hasImporterManifest(join(bookijiPackages, n)))
}

/** Prefer `.bookiji-packages` when populated (standalone / post vercel-install); else umbrella `packages/`. */
function pickPackagesRoot() {
  if (bookijiCloneHasPackages()) return bookijiPackages
  for (const name of names) {
    if (hasImporterManifest(join(umbrellaPackages, name))) {
      return umbrellaPackages
    }
  }
  if (isDir(bookijiPackages)) return bookijiPackages
  return null
}

const packagesRoot = pickPackagesRoot()

/**
 * Path filter so pnpm does not match both `../../packages/foo` and `monorepo-packages/foo`
 * (same @bookiji-inc name → two builds, OOM on Windows).
 */
function filterSelectorForPackage(name) {
  if (packagesRoot === bookijiPackages) {
    return `./monorepo-packages/${name}`.replace(/\\/g, '/')
  }
  return `./../../packages/${name}`.replace(/\\/g, '/')
}

function nodeOptionsWithHeap() {
  const cur = process.env.NODE_OPTIONS || ''
  if (/--max-old-space-size=\d+/.test(cur)) return cur
  return `${cur} --max-old-space-size=16384`.trim()
}

/** @param {string[]} args e.g. ['install'] or ['run', 'build'] */
function runPnpm(args, cwd) {
  const env = { ...process.env, NODE_OPTIONS: nodeOptionsWithHeap() }
  if (process.platform === 'win32') {
    const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')
    execSync(`pnpm ${quoted}`, { cwd, stdio: 'inherit', shell: true, env })
  } else {
    execFileSync('pnpm', args, { cwd, stdio: 'inherit', env })
  }
}

if (!packagesRoot || !isDir(packagesRoot)) {
  console.log(
    `[build-bookiji-packages] Skip: monorepo packages dir not found. OK for standalone Kinetix deploy without .bookiji-packages fallback.`
  )
  process.exit(0)
}

let built = 0
for (const name of names) {
  const dir = join(packagesRoot, name)
  if (!isDir(dir)) {
    console.log(`[build-bookiji-packages] Skip missing: ${dir}`)
    continue
  }
  if (!hasImporterManifest(dir)) {
    console.error(
      `[build-bookiji-packages] ${dir} has no package.json (empty dir, incomplete Bookiji-inc clone, or wrong packages root).`
    )
    process.exit(1)
  }
  const sel = filterSelectorForPackage(name)
  console.log(`[build-bookiji-packages] ${sel}`)
  runPnpm(['--filter', sel, 'run', 'build'], kinetixRoot)
  built++
}

if (built === 0) {
  console.log('[build-bookiji-packages] No package dirs built; continuing.')
}
