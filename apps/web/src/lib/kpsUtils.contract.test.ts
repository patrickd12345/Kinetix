import { describe, expect, it } from 'vitest'
import type { RunRecord, PBRecord } from './database'
import { calculateRelativeKPSSync } from './kpsUtils'
import type { UserProfile } from '@kinetix/core'

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
})
