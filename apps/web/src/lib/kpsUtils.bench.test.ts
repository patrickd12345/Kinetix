import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensurePBInitialized, filterRunsByRelativeKpsBounds } from './kpsUtils'
import { db } from './database'
import * as database from './database'
import * as authState from './authState'
import { RUN_VISIBLE } from './database'

describe('kpsUtils performance baseline', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(database, 'getWeightsForDates').mockResolvedValue(new Map())
    // Need to set an active profile since resolveProfileForRunWithWeightCache needs it synchronously
    authState.setActivePlatformProfile({ id: 'user-1', email: 'test@test.com' } as any)
  })

  it('measures N+1 queries in ensurePBInitialized', async () => {
    const runs = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      date: `2024-01-0${(i % 9) + 1}`,
      duration: 1800,
      distance: 5000,
      deleted: RUN_VISIBLE
    }))

    vi.spyOn(db.runs, 'toArray').mockResolvedValue(runs as any)
    vi.spyOn(db.runs, 'filter').mockReturnValue({
      toArray: vi.fn().mockResolvedValue(runs.filter((r) => r.deleted === RUN_VISIBLE && !!r.id))
    } as any)
    vi.spyOn(db.runs, 'get').mockResolvedValue(runs[0] as any)
    vi.spyOn(db.pb, 'toArray').mockResolvedValue([])
    vi.spyOn(db.pb, 'add').mockResolvedValue(1)

    // We intentionally simulate a delay for getProfileForRun to emulate DB cost
    const getProfileSpy = vi.spyOn(authState, 'getProfileForRun').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 2))
      return { age: 30, weightKg: 70 }
    })

    const start = performance.now()
    await ensurePBInitialized({ age: 30, weightKg: 70 })
    const end = performance.now()

    console.log(`ensurePBInitialized simulated DB time: ${end - start}ms`)
    console.log(`getProfileForRun calls: ${getProfileSpy.mock.calls.length}`)

    expect(getProfileSpy).toHaveBeenCalledTimes(0)
  })

  it('measures N+1 queries in filterRunsByRelativeKpsBounds', async () => {
    const runs = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      date: `2024-01-0${(i % 9) + 1}`,
      duration: 1800,
      distance: 5000,
      deleted: RUN_VISIBLE
    }))

    vi.spyOn(db.runs, 'get').mockResolvedValue(runs[0] as any)
    vi.spyOn(db.pb, 'toArray').mockResolvedValue([{ id: 1, runId: 1, achievedAt: '2024-01-01', profileSnapshot: { age: 30, weightKg: 70 } }])

    const getProfileSpy = vi.spyOn(authState, 'getProfileForRun').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 2))
      return { age: 30, weightKg: 70 }
    })

    const start = performance.now()
    await filterRunsByRelativeKpsBounds(runs as any, 50, 150)
    const end = performance.now()

    console.log(`filterRunsByRelativeKpsBounds simulated DB time: ${end - start}ms`)
    console.log(`getProfileForRun calls: ${getProfileSpy.mock.calls.length}`)

    expect(getProfileSpy).toHaveBeenCalledTimes(0)
  })
})
