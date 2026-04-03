import { describe, it, expect } from 'vitest'
import { computeKpsMedalsForRuns } from './kpsMedals'
import type { RunRecord } from './database'

const baseRun = (id: number, distance: number, duration: number): RunRecord => ({
  id,
  date: '2026-01-01T10:00:00.000Z',
  distance,
  duration,
  averagePace: 300,
  targetKPS: 80,
  locations: [],
  splits: [],
  notes: 'Test',
})

describe('computeKpsMedalsForRuns', () => {
  it('assigns gold/silver/bronze to top three rounded tiers', () => {
    const runs = [
      baseRun(1, 5000, 1500),
      baseRun(2, 5000, 1600),
      baseRun(3, 5000, 1700),
      baseRun(4, 5000, 1800),
    ]
    const map = new Map<number, number>([
      [1, 100],
      [2, 92],
      [3, 91],
      [4, 80],
    ])
    const m = computeKpsMedalsForRuns(runs, map)
    expect(m.get(1)).toBe('gold')
    expect(m.get(2)).toBe('silver')
    expect(m.get(3)).toBe('bronze')
    expect(m.get(4)).toBeUndefined()
  })

  it('ties share the same medal', () => {
    const runs = [baseRun(1, 5000, 1500), baseRun(2, 5000, 1500)]
    const map = new Map<number, number>([
      [1, 100],
      [2, 100.2],
    ])
    const m = computeKpsMedalsForRuns(runs, map)
    expect(m.get(1)).toBe('gold')
    expect(m.get(2)).toBe('gold')
  })

  it('always gives gold to rounded 100 when present', () => {
    const runs = [baseRun(1, 5000, 1500), baseRun(2, 5000, 1500), baseRun(3, 5000, 1500)]
    const map = new Map<number, number>([
      [1, 100],
      [2, 92],
      [3, 99],
    ])
    const m = computeKpsMedalsForRuns(runs, map)
    expect(m.get(1)).toBe('gold')
    expect(m.get(3)).toBe('silver')
    expect(m.get(2)).toBe('bronze')
  })

  it('returns empty when no meaningful runs', () => {
    const runs: RunRecord[] = [baseRun(1, 100, 30)]
    const map = new Map<number, number>([[1, 50]])
    expect(computeKpsMedalsForRuns(runs, map).size).toBe(0)
  })

  it('six-run leaderboard: 60 gold, 56 silver tier, 53 bronze (47 unplaced)', () => {
    const runs = [
      baseRun(101, 5000, 1500),
      baseRun(102, 5000, 1500),
      baseRun(103, 5000, 1500),
      baseRun(104, 5000, 1500),
      baseRun(105, 5000, 1500),
      baseRun(106, 5000, 1500),
    ]
    const map = new Map<number, number>([
      [101, 56],
      [102, 47],
      [103, 60],
      [104, 56],
      [105, 56],
      [106, 53],
    ])
    const m = computeKpsMedalsForRuns(runs, map)
    expect(m.get(103)).toBe('gold')
    expect(m.get(101)).toBe('silver')
    expect(m.get(104)).toBe('silver')
    expect(m.get(105)).toBe('silver')
    expect(m.get(106)).toBe('bronze')
    expect(m.get(102)).toBeUndefined()
  })
})
