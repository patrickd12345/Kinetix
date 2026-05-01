#!/usr/bin/env node
/**
 * Kinetix-only Vercel parity — same Phase 1 steps as `scripts/verify-vercel-parity.mjs`
 * but **does not** run `products/bookiji` (avoids Next.js OOM / long unrelated builds on agents).
 *
 * Mirrors Vercel: check-workspace layout, `vercel-install.sh`, type-check, lint, root `pnpm run build`.
 *
 * Usage: node scripts/verify-kinetix-parity.mjs
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

if (!/--max-old-space-size=\d+/.test(process.env.NODE_OPTIONS || '')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-old-space-size=16384`.trim()
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = dirname(scriptDir)

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

function runPnpm(args) {
  run('npx', ['-y', 'pnpm@10.30.3', ...args], true)
}

console.log('[verify-kinetix-parity] check-workspace-package-layout')
run('node', [join(scriptDir, 'check-no-local-ai-core.mjs')])

const bash = bashPath()
console.log('[verify-kinetix-parity] scripts/vercel-install.sh')
const install = spawnSync(bash, [join(scriptDir, 'vercel-install.sh')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})
exitCode(install.status)

console.log('[verify-kinetix-parity] pnpm type-check')
runPnpm(['type-check'])
console.log('[verify-kinetix-parity] pnpm lint')
runPnpm(['lint'])
console.log('[verify-kinetix-parity] pnpm run build')
runPnpm(['run', 'build'])

console.log('[verify-kinetix-parity] OK (Bookiji step intentionally skipped — use verify:vercel-parity when umbrella Bookiji parity is needed)')
