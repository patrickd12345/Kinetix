import { execFileSync, execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const _heap = '--max-old-space-size=16384'
if (!/--max-old-space-size=\d+/.test(process.env.NODE_OPTIONS || '')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} ${_heap}`.trim()
}

/**
 * Builds `@bookiji-inc/*` workspace packages from `monorepo-packages/` (committed source of truth).
 * Vercel `scripts/vercel-install.sh` may refresh `monorepo-packages/` from a Bookiji-inc clone before install;
 * local dev uses the same tree so resolution matches production.
 *
 * Uses `pnpm --filter ./monorepo-packages/<name>` from the Kinetix root (single workspace graph).
 */
const scriptDir = dirname(fileURLToPath(import.meta.url))
const kinetixRoot = dirname(scriptDir)
const monoRoot = join(kinetixRoot, 'monorepo-packages')
const names = [
  'error-contract',
  'observability',
  'platform-auth',
  'stripe-runtime',
  'ai-core',
  'ai-runtime',
  'persistent-memory-runtime',
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

if (!isDir(monoRoot)) {
  console.error(`[build-bookiji-packages] Missing ${monoRoot}. Add monorepo-packages/ or run scripts/vercel-install.sh.`)
  process.exit(1)
}

let built = 0
for (const name of names) {
  const dir = join(monoRoot, name)
  if (!isDir(dir) || !hasImporterManifest(dir)) {
    console.error(`[build-bookiji-packages] Missing or invalid package: ${dir}`)
    process.exit(1)
  }
  const sel = `./monorepo-packages/${name}`.replace(/\\/g, '/')
  console.log(`[build-bookiji-packages] ${sel}`)
  runPnpm(['--filter', sel, 'run', 'build'], kinetixRoot)
  built++
}

if (built === 0) {
  console.error('[build-bookiji-packages] No packages built.')
  process.exit(1)
}
