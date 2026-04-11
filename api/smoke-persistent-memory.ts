/**
 * Smoke: verifies Kinetix wiring for persistent memory (disk JSON, no live LLM).
 * Run: pnpm run smoke:persistent-memory (from products/Kinetix)
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commitSessionBoundary, resolveMemoryFilePath, startSession } from '@bookiji-inc/persistent-memory-runtime'
import { buildKinetixBoundaryFromChat } from './_lib/ai/kinetixMemoryBoundary.js'

async function main() {
  const base = await mkdtemp(join(tmpdir(), 'kinetix-pmem-'))
  process.env.PERSISTENT_MEMORY_ROOT = base
  const h = await startSession('kinetix', 'smoke-tenant')
  const boundary = buildKinetixBoundaryFromChat(
    [
      { role: 'system', content: 'test' },
      { role: 'user', content: 'easy run today' },
    ],
    'Keep it easy.',
    'smoke',
  )
  await commitSessionBoundary(h, boundary)
  const path = resolveMemoryFilePath('kinetix', 'smoke-tenant')
  const raw = await readFile(path, 'utf8')
  const parsed = JSON.parse(raw) as { lastCommitted: { sessionSummary: string } }
  if (parsed.lastCommitted.sessionSummary !== 'Keep it easy.') {
    throw new Error('unexpected boundary payload')
  }
  await rm(base, { recursive: true, force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
