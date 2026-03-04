import { describe, expect, it } from 'vitest'
import type { RunRecord } from './database'
import {
  buildMaxKPSPaceDurationPoints,
  toPaceSecondsForUnit,
} from './maxKpsPaceChart'

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
  it('keeps only the max-KPS run in each duration bucket', () => {
    const runs: RunRecord[] = [
      makeRun({ id: 1, duration: 610, averagePace: 310, kps: 71 }),
      makeRun({ id: 2, duration: 625, averagePace: 305, kps: 83 }),
      makeRun({ id: 3, duration: 910, averagePace: 320, kps: 77 }),
    ]

    const points = buildMaxKPSPaceDurationPoints(runs, 'metric', 300)

    expect(points).toHaveLength(2)
    expect(points[0].runId).toBe(2)
    expect(points[0].kps).toBe(83)
    expect(points[1].runId).toBe(3)
    expect(points[1].bucketStartSeconds).toBe(900)
  })

  it('converts pace and distance for imperial display', () => {
    const runs: RunRecord[] = [makeRun({ averagePace: 300, distance: 5000, kps: 80 })]

    const [point] = buildMaxKPSPaceDurationPoints(runs, 'imperial')

    expect(point.paceSeconds).toBeCloseTo(482.802, 3)
    expect(point.distanceDisplay).toBeCloseTo(3.106855, 6)
    expect(point.distanceUnitLabel).toBe('mi')
    expect(point.paceLabel.endsWith('/mi')).toBe(true)
  })

  it('ignores runs with invalid performance values', () => {
    const runs: RunRecord[] = [
      makeRun({ id: 1, duration: 0, kps: 80 }),
      makeRun({ id: 2, averagePace: 0, kps: 80 }),
      makeRun({ id: 3, distance: 0, kps: 80 }),
      makeRun({ id: 4, kps: -1 }),
    ]

    const points = buildMaxKPSPaceDurationPoints(runs, 'metric')

    expect(points).toHaveLength(0)
  })
})

describe('toPaceSecondsForUnit', () => {
  it('keeps metric pace unchanged and converts imperial pace', () => {
    expect(toPaceSecondsForUnit(300, 'metric')).toBe(300)
    expect(toPaceSecondsForUnit(300, 'imperial')).toBeCloseTo(482.802, 3)
  })
})
