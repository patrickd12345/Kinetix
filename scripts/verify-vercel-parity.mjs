/**
 * Phase 1 — Kinetix standalone (Vercel-style): clone Bookiji-inc packages into monorepo-packages,
 * install, type-check, lint, build (apps/web). Same as historical "Web CI" parity.
 *
 * Phase 2 — Bookiji app: `scripts/verify-bookiji-vercel-build.mjs` runs under products/bookiji
 * with Vercel-like env (install keeps devDependencies; build uses production flags). Catches
 * failures that only appear in the Bookiji Vercel project (rootDirectory = products/bookiji).
 *
 * Requires: git, bash (Git Bash on Windows), Node 22+, npm/npx (uses `npx pnpm@10.30.3`, not corepack on Windows).
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

if (!/--max-old-space-size=\d+/.test(process.env.NODE_OPTIONS || '')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-old-space-size=16384`.trim()
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = dirname(scriptDir)
/** Bookiji-inc repo root (products/Kinetix/scripts -> ../../..). */
const repoRoot = join(scriptDir, '../../..')

function exitCode(code) {
  if (code !== 0 && code != null) process.exit(code)
}

function run(cmd, args, shell) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: Boolean(shell),
    env: process.env,
  })
  exitCode(r.status)
}

function bashPath() {
  if (process.platform !== 'win32') return 'bash'
  const gitBash = join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
  if (existsSync(gitBash)) return gitBash
  return 'bash'
}

/** Same pnpm version as packageManager / vercel-install (no corepack — avoids EPERM on Windows). */
function runPnpm(args) {
  run('npx', ['-y', 'pnpm@10.30.3', ...args], true)
}

console.log('[verify-vercel-parity] check-no-local-ai-core')
run('node', [join(scriptDir, 'check-no-local-ai-core.mjs')])

const bash = bashPath()
console.log('[verify-vercel-parity] scripts/vercel-install.sh')
const install = spawnSync(bash, [join(scriptDir, 'vercel-install.sh')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})
exitCode(install.status)

console.log('[verify-vercel-parity] pnpm type-check')
runPnpm(['type-check'])
console.log('[verify-vercel-parity] pnpm lint')
runPnpm(['lint'])
console.log('[verify-vercel-parity] pnpm run build')
runPnpm(['run', 'build'])

console.log('[verify-vercel-parity] products/bookiji — Vercel-like install + build')
const bookiji = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'verify-bookiji-vercel-build.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
})
exitCode(bookiji.status)

console.log('[verify-vercel-parity] OK')
