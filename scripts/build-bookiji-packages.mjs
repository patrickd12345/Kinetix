import { execFileSync, execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Umbrella checkout: `products/Kinetix/scripts` -> `../../../packages` = repo-root `packages/`.
 * Standalone Kinetix clone (e.g. Vercel): that path does not exist — skip (deps come from root `pnpm install`).
 *
 * On Linux/macOS: `execFileSync('pnpm', argv)` — no `/bin/sh` (avoids ENOENT when cwd is wrong).
 * On Windows: `execSync` + `shell: true` so `pnpm` resolves (pnpm.cmd).
 */
const scriptDir = dirname(fileURLToPath(import.meta.url))
const packagesRoot = isDir(join(scriptDir, '../../../packages')) 
  ? join(scriptDir, '../../../packages') 
  : join(scriptDir, '../.bookiji-packages')
const names = ['ai-runtime', 'persistent-memory-runtime', 'error-contract', 'observability']

function isDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** @param {string[]} args e.g. ['install'] or ['run', 'build'] */
function runPnpm(args, cwd) {
  if (process.platform === 'win32') {
    const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')
    execSync(`pnpm ${quoted}`, { cwd, stdio: 'inherit', shell: true })
  } else {
    execFileSync('pnpm', args, { cwd, stdio: 'inherit' })
  }
}

if (!isDir(packagesRoot)) {
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
  runPnpm(['install'], dir)
  runPnpm(['run', 'build'], dir)
  built++
}

if (built === 0) {
  console.log('[build-bookiji-packages] No package dirs built; continuing.')
}
