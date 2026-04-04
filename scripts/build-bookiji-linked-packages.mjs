/**
 * Builds umbrella @bookiji-inc/* packages that Kinetix links via package.json (../../packages/*).
 * Vitest resolves those packages through package exports → dist/; clean clones need this before tests.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const umbrellaRoot = join(__dirname, '..', '..', '..')

const packages = [
  'error-contract',
  'observability',
  'stripe-runtime',
  'ai-runtime',
  'persistent-memory-runtime',
]

function run(cwd, args) {
  const r = spawnSync('pnpm', args, { cwd, stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

for (const name of packages) {
  const dir = join(umbrellaRoot, 'packages', name)
  const pkgJson = join(dir, 'package.json')
  if (!existsSync(pkgJson)) {
    console.warn(`[build-bookiji-linked] skip ${name}: ${pkgJson} not found`)
    continue
  }
  if (!existsSync(join(dir, 'node_modules'))) {
    run(dir, ['install'])
  }
  run(dir, ['run', 'build'])
}
