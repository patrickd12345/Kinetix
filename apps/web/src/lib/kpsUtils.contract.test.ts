import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { RunRecord, PBRecord } from './database'
import { calculateRelativeKPSSync, calculateBestRecentRelativeKPSSync } from './kpsUtils'
import type { UserProfile } from '@kinetix/core'
import { setActivePlatformProfile } from './authState'

function makeRun(overrides: Partial<RunRecord>): RunRecord {
  return {
    id: 1,
    date: '2026-01-01T10:00:00.000Z',
    distance: 5000,
    duration: 1500,
    averagePace: 300,
    kps: 70,
    targetKPS: 75,
    locations: [],
    splits: [],
    ...overrides,
  }
}

const profile: UserProfile = { age: 35, weightKg: 70 }
const pbProfile: UserProfile = { age: 35, weightKg: 70 }
const pb: PBRecord = {
  id: 1,
  runId: 10,
  achievedAt: '2025-09-30T10:00:00.000Z',
  profileSnapshot: pbProfile,
}

describe('KPS contract invariants', () => {
  it('returns 100 exactly for the PB run', () => {
    const pbRun = makeRun({ id: 10, distance: 5000, duration: 1500, averagePace: 300 })
    const score = calculateRelativeKPSSync(pbRun, profile, pb, pbRun)
    expect(score).toBe(100)
  })

  it('returns 100 for PB run even when absolute KPS is invalid (anchor invariant)', () => {
    const badPbRun = makeRun({ id: 10, distance: 0, duration: 0, averagePace: 0 })
    const score = calculateRelativeKPSSync(badPbRun, profile, pb, badPbRun)
    expect(score).toBe(100)
  })

  it('treats string/number runId as PB match like numeric equality', () => {
    const pbRun = makeRun({ id: 10, distance: 5000, duration: 1500, averagePace: 300 })
    const pbStr: PBRecord = { ...pb, runId: 10 as unknown as number }
    const score = calculateRelativeKPSSync({ ...pbRun, id: '10' as unknown as number }, profile, pbStr, pbRun)
    expect(score).toBe(100)
  })

  it('returns a ratio for non-PB runs', () => {
    const pbRun = makeRun({ id: 10, distance: 5000, duration: 1500, averagePace: 300 })
    const slowerRun = makeRun({ id: 11, distance: 5000, duration: 1650, averagePace: 330 })
    const score = calculateRelativeKPSSync(slowerRun, profile, pb, pbRun)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('returns 0 when PB context is missing (strict relative mode)', () => {
    const run = makeRun({ id: 11, distance: 5000, duration: 1600, averagePace: 320 })
    expect(calculateRelativeKPSSync(run, profile, null, null)).toBe(0)
  })

  it('caps displayed relative KPS at 100 when a run outpaces a stale PB anchor (profile drift / bad anchor)', () => {
    const pbRun = makeRun({ id: 10, distance: 5000, duration: 1800, averagePace: 360 })
    const faster = makeRun({ id: 11, distance: 5000, duration: 1500, averagePace: 300 })
    const score = calculateRelativeKPSSync(faster, profile, pb, pbRun)
    expect(score).toBe(100)
  })
})

describe('calculateBestRecentRelativeKPSSync invariant', () => {
  beforeEach(() => {
    setActivePlatformProfile({ id: 'test-user', age: 35, weight_kg: 70 })
  })

  afterEach(() => {
    setActivePlatformProfile(null)
  })

  it('returns the highest relative KPS from an array of runs', () => {
    const pbRun = makeRun({ id: 10, distance: 5000, duration: 1500, averagePace: 300 })
    const run1 = makeRun({ id: 11, distance: 5000, duration: 1700, averagePace: 340 })
    const run2 = makeRun({ id: 12, distance: 5000, duration: 1600, averagePace: 320 }) // Faster run
    const run3 = makeRun({ id: 13, distance: 5000, duration: 1800, averagePace: 360 })

    const runs = [run1, run2, run3]
    const weightMap = new Map<string, number>()
    // For simplicity, default weight is provided by resolveProfileForRunWithWeightCache
    const bestKPS = calculateBestRecentRelativeKPSSync(runs, weightMap, pb, pbRun)

    const expectedKPS1 = calculateRelativeKPSSync(run1, profile, pb, pbRun)
    const expectedKPS2 = calculateRelativeKPSSync(run2, profile, pb, pbRun)
    const expectedKPS3 = calculateRelativeKPSSync(run3, profile, pb, pbRun)

    expect(bestKPS).toBe(Math.max(expectedKPS1, expectedKPS2, expectedKPS3))
    expect(bestKPS).toBe(expectedKPS2) // The 1600 duration run is the best
  })

  it('returns null if there are no runs or no PB', () => {
    const pbRun = makeRun({ id: 10, distance: 5000, duration: 1500, averagePace: 300 })
    const runs = [makeRun({ id: 11, distance: 5000, duration: 1700, averagePace: 340 })]
    const weightMap = new Map<string, number>()

    expect(calculateBestRecentRelativeKPSSync([], weightMap, pb, pbRun)).toBeNull()
    expect(calculateBestRecentRelativeKPSSync(runs, weightMap, null, pbRun)).toBeNull()
    expect(calculateBestRecentRelativeKPSSync(runs, weightMap, pb, null)).toBeNull()
  })
})
