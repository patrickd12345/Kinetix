import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunRecord } from './database'
import {
  buildMaxKPSPaceDurationPoints,
  generateKps100Curve,
  toPaceSecondsForUnit,
} from './maxKpsPaceChart'
import type { UserProfile } from '@kinetix/core'

vi.mock('./kpsUtils', () => ({
  getPB: vi.fn(async () => ({ id: 1, runId: 99, achievedAt: '2025-09-30T10:00:00.000Z', profileSnapshot: { age: 35, weightKg: 70 } })),
  getPBRun: vi.fn(async () => ({ id: 99, date: '2025-09-30T10:00:00.000Z', distance: 5000, duration: 1500, averagePace: 300, kps: 100, targetKPS: 100, locations: [], splits: [] })),
  calculateRelativeKPSSync: vi.fn((run: RunRecord) => run.kps),
  isValidKPS: vi.fn((kps: number) => Number.isFinite(kps) && kps > 0),
}))

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

describe('buildMaxKPSPaceDurationPoints', () => {
  const getProfileForRun = async (): Promise<UserProfile> => ({ age: 35, weightKg: 70 })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps only the max-KPS run in each duration bucket', async () => {
    const runs: RunRecord[] = [
      makeRun({ id: 1, duration: 610, averagePace: 310, kps: 71 }),
      makeRun({ id: 2, duration: 625, averagePace: 305, kps: 83 }),
      makeRun({ id: 3, duration: 910, averagePace: 320, kps: 77 }),
    ]

    const points = await buildMaxKPSPaceDurationPoints(runs, 'metric', getProfileForRun, 300)

    expect(points).toHaveLength(2)
    expect(points[0].runId).toBe(2)
    expect(points[0].kps).toBe(83)
    expect(points[1].runId).toBe(3)
    expect(points[1].bucketStartSeconds).toBe(900)
  })

  it('converts pace and distance for imperial display', async () => {
    const runs: RunRecord[] = [makeRun({ averagePace: 300, distance: 5000, kps: 80 })]

    const [point] = await buildMaxKPSPaceDurationPoints(runs, 'imperial', getProfileForRun)

    expect(point.paceSeconds).toBeCloseTo(482.802, 3)
    expect(point.distanceDisplay).toBeCloseTo(3.106855, 6)
    expect(point.distanceUnitLabel).toBe('mi')
    expect(point.paceLabel.endsWith('/mi')).toBe(true)
  })

  it('ignores runs with invalid performance values', async () => {
    const runs: RunRecord[] = [
      makeRun({ id: 1, duration: 0, kps: 80 }),
      makeRun({ id: 2, averagePace: 0, kps: 80 }),
      makeRun({ id: 3, distance: 0, kps: 80 }),
      makeRun({ id: 4, kps: -1 }),
      makeRun({ id: 5, averagePace: 12000, kps: 80 }), // bad data: pace stored as duration
    ]

    const points = await buildMaxKPSPaceDurationPoints(runs, 'metric', getProfileForRun)

    expect(points).toHaveLength(0)
  })
})

describe('toPaceSecondsForUnit', () => {
  it('keeps metric pace unchanged and converts imperial pace', () => {
    expect(toPaceSecondsForUnit(300, 'metric')).toBe(300)
    expect(toPaceSecondsForUnit(300, 'imperial')).toBeCloseTo(482.802, 3)
  })
})

describe('generateKps100Curve', () => {
  const userProfile: UserProfile = { age: 35, weightKg: 70 }

  it('returns empty array for invalid or zero pbAbsoluteKps', () => {
    expect(generateKps100Curve(0, userProfile, 'metric')).toEqual([])
    expect(generateKps100Curve(-1, userProfile, 'metric')).toEqual([])
    expect(generateKps100Curve(NaN, userProfile, 'metric')).toEqual([])
  })

  it('returns 7 points for valid pbAbsoluteKps (milestone distances)', () => {
    const points = generateKps100Curve(100, userProfile, 'metric')
    expect(points).toHaveLength(7)
    expect(points.map((p) => p.distanceKm)).toEqual([1, 3, 5, 10, 15, 21.0975, 42.195])
    points.forEach((p) => {
      expect(p).toHaveProperty('distanceLabel')
      expect(p).toHaveProperty('paceLabel')
      expect(p).toHaveProperty('timeLabel')
      expect(p.timeSeconds).toBeGreaterThan(0)
      expect(p.paceSecondsPerKm).toBeGreaterThan(0)
    })
  })

  it('formats distance and pace for imperial', () => {
    const points = generateKps100Curve(100, userProfile, 'imperial')
    expect(points[0].distanceUnitLabel).toBe('mi')
    expect(points[0].paceLabel.endsWith('/mi')).toBe(true)
    expect(points[0].distanceDisplay).toBeCloseTo(0.621371, 5)
  })
})
