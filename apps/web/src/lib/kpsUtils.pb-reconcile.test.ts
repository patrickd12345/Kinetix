import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '@kinetix/core'
import type { PBRecord, RunRecord } from './database'

const state = vi.hoisted(() => ({
  runsStore: [] as RunRecord[],
  pbStore: [] as PBRecord[],
  getProfileForRunMock: vi.fn(async (run: { id?: number }) => {
    if (run.id === 2) return { age: 32, weightKg: 68 } as UserProfile
    return { age: 40, weightKg: 78 } as UserProfile
  }),
  dbMock: {
    runs: {
      toArray: vi.fn(async () => state.runsStore),
      filter: vi.fn((predicate: (r: RunRecord) => boolean) => ({
        toArray: vi.fn(async () => state.runsStore.filter(predicate))
      })),
      get: vi.fn(async (id: number) => state.runsStore.find((r) => r.id === id) ?? undefined),
    },
    pb: {
      toArray: vi.fn(async () => state.pbStore),
      add: vi.fn(async (record: Omit<PBRecord, 'id'>) => {
        const id = state.pbStore.length + 1
        state.pbStore.push({ ...record, id })
        return id
      }),
      update: vi.fn(async (id: number, patch: Partial<PBRecord>) => {
        const idx = state.pbStore.findIndex((p) => p.id === id)
        if (idx === -1) return 0
        state.pbStore[idx] = { ...state.pbStore[idx], ...patch }
        return 1
      }),
    },
    getWeightsForDates: vi.fn(async () => new Map<string, number>()),
  },
}))

vi.mock('./database', () => ({
  db: state.dbMock,
  RUN_VISIBLE: 0,
  getWeightsForDates: state.dbMock.getWeightsForDates,
}))

vi.mock('./authState', () => ({
  getProfileForRun: state.getProfileForRunMock,
  resolveProfileForRunWithWeightCache: (
    _weightMap: any,
    run: { id?: number }
  ) => (run.id === 2 ? { age: 32, weightKg: 68 } : { age: 40, weightKg: 78 }),
}))

import {
  calculateRelativeKPSSync,
  ensurePBInitialized,
  getPB,
  getPBRun,
} from './kpsUtils'

function makeRun(overrides: Partial<RunRecord>): RunRecord {
  return {
    id: 1,
    date: '2026-01-01T10:00:00.000Z',
    distance: 5000,
    duration: 1500,
    averagePace: 300,
    targetKPS: 100,
    locations: [],
    splits: [],
    ...overrides,
  }
}

describe('ensurePBInitialized - lifetime PB reconciliation', () => {
  beforeEach(() => {
    state.runsStore = []
    state.pbStore = []
    vi.clearAllMocks()
  })

  it('creates PB when missing using lifetime best absolute KPS', async () => {
    state.runsStore = [
      makeRun({ id: 1, duration: 1800, averagePace: 360 }),
      makeRun({ id: 2, duration: 1200, averagePace: 240 }),
    ]

    await ensurePBInitialized({ age: 35, weightKg: 70 })

    expect(state.pbStore).toHaveLength(1)
    expect(state.pbStore[0].runId).toBe(2)
    expect(state.pbStore[0].profileSnapshot).toEqual({ age: 32, weightKg: 68 })
  })

  it('reconciles legacy manualReference rows to the true lifetime best', async () => {
    state.runsStore = [
      makeRun({ id: 1, duration: 1800, averagePace: 360 }),
      makeRun({ id: 2, duration: 1200, averagePace: 240 }),
    ]
    state.pbStore = [
      {
        id: 1,
        runId: 1,
        achievedAt: state.runsStore[0].date,
        profileSnapshot: { age: 40, weightKg: 78 },
        manualReference: true,
      } as PBRecord & { manualReference: true },
    ]

    await ensurePBInitialized({ age: 35, weightKg: 70 })

    expect(state.pbStore[0].runId).toBe(2)
    expect(state.pbStore[0].profileSnapshot).toEqual({ age: 32, weightKg: 68 })
  })

  it('reconciles an incorrect existing PB to true lifetime best', async () => {
    state.runsStore = [
      makeRun({ id: 1, duration: 1800, averagePace: 360 }),
      makeRun({ id: 2, duration: 1200, averagePace: 240 }),
    ]
    state.pbStore = [
      {
        id: 1,
        runId: 1,
        achievedAt: state.runsStore[0].date,
        profileSnapshot: { age: 40, weightKg: 78 },
      },
    ]

    await ensurePBInitialized({ age: 35, weightKg: 70 })

    expect(state.pbStore).toHaveLength(1)
    expect(state.pbStore[0].runId).toBe(2)
    expect(state.pbStore[0].profileSnapshot).toEqual({ age: 32, weightKg: 68 })
  })

  it('guarantees top relative KPS is 100 after reconciliation', async () => {
    state.runsStore = [
      makeRun({ id: 1, duration: 1800, averagePace: 360 }),
      makeRun({ id: 2, duration: 1200, averagePace: 240 }),
      makeRun({ id: 3, duration: 1500, averagePace: 300 }),
    ]
    state.pbStore = [
      {
        id: 1,
        runId: 1,
        achievedAt: state.runsStore[0].date,
        profileSnapshot: { age: 40, weightKg: 78 },
      },
    ]

    await ensurePBInitialized({ age: 35, weightKg: 70 })

    const pb = await getPB()
    const pbRun = await getPBRun()
    expect(pb?.runId).toBe(2)
    expect(pbRun?.id).toBe(2)

    const relativeScores: number[] = []
    for (const run of state.runsStore) {
      const profileForRun = await state.getProfileForRunMock(run)
      relativeScores.push(calculateRelativeKPSSync(run, profileForRun, pb ?? null, pbRun))
    }

    expect(Math.max(...relativeScores)).toBe(100)
    expect(relativeScores.every((score) => score <= 100)).toBe(true)
  })
})
