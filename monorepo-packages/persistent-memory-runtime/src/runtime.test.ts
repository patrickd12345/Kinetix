import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  commitSessionBoundary,
  emptySessionBoundaryPayload,
  resolveMemoryFilePath,
  runSession,
  startSession,
} from './runtime.js'

describe('persistent memory runtime', () => {
  const base = join(process.cwd(), 'tmp-pmem-test')
  const prev = process.env.PERSISTENT_MEMORY_ROOT

  beforeEach(async () => {
    process.env.PERSISTENT_MEMORY_ROOT = base
    await mkdir(base, { recursive: true })
  })

  afterEach(async () => {
    process.env.PERSISTENT_MEMORY_ROOT = prev
    await rm(base, { recursive: true, force: true })
  })

  it('startSession loads empty then commit persists', async () => {
    const h = await startSession('bookiji', 'user-1')
    expect(h.memory.lastCommitted).toBeNull()
    const p = emptySessionBoundaryPayload('smoke')
    p.next_actions.push('x')
    await commitSessionBoundary(h, p)
    const raw = await readFile(resolveMemoryFilePath('bookiji', 'user-1'), 'utf8')
    const disk = JSON.parse(raw) as { lastCommitted: { sessionSummary: string } }
    expect(disk.lastCommitted.sessionSummary).toBe('smoke')
  })

  it('runSession passes handle with loaded memory', async () => {
    const h0 = await startSession('chess', 't1')
    await commitSessionBoundary(h0, emptySessionBoundaryPayload('first'))
    const summary = await runSession('chess', 't1', async (ctx) => ctx.memory.lastCommitted?.sessionSummary ?? '')
    expect(summary).toBe('first')
  })
})
