import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packagesRoot = join(scriptDir, '../../../packages')
const names = ['ai-runtime', 'persistent-memory-runtime', 'error-contract', 'observability']

for (const name of names) {
  const dir = join(packagesRoot, name)
  execSync('pnpm install', { cwd: dir, stdio: 'inherit' })
  execSync('pnpm run build', { cwd: dir, stdio: 'inherit' })
}
