import { readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const distAssets = join(repoRoot, 'apps', 'web', 'dist', 'assets')
const maxMainChunkBytes = 900 * 1024

let candidates
try {
  candidates = readdirSync(distAssets)
    .filter((name) => /^index-[\w-]+\.js$/.test(name))
    .map((name) => {
      const path = join(distAssets, name)
      return { name, bytes: statSync(path).size }
    })
} catch (error) {
  console.error(`[bundle-budget] Unable to inspect ${distAssets}:`, error)
  process.exit(1)
}

if (candidates.length === 0) {
  console.error('[bundle-budget] No main index chunk found in apps/web/dist/assets.')
  process.exit(1)
}

const main = candidates.sort((a, b) => b.bytes - a.bytes)[0]
if (main.bytes > maxMainChunkBytes) {
  console.error(
    `[bundle-budget] ${main.name} is ${(main.bytes / 1024).toFixed(1)} kB, over ${(maxMainChunkBytes / 1024).toFixed(0)} kB.`,
  )
  process.exit(1)
}

console.log(
  `[bundle-budget] ${main.name} is ${(main.bytes / 1024).toFixed(1)} kB, within ${(maxMainChunkBytes / 1024).toFixed(0)} kB.`,
)
