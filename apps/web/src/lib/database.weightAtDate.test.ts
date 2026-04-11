import { describe, expect, it } from 'vitest'
import { weightKgAtOrBeforeRunUnix, weightKgByRunDateKeysFromEntries, type WeightEntry } from './database'

function naiveWeightMap(unique: string[], sorted: WeightEntry[]): Map<string, number> {
  const result = new Map<string, number>()
  for (const d of unique) {
    let best: WeightEntry | null = null
    for (const e of sorted) {
      if (e.date <= d) best = e
      else break
    }
    if (best != null && best.kg > 0) result.set(d, best.kg)
  }
  return result
}

describe('weightKgAtOrBeforeRunUnix', () => {
  it('picks the latest measurement on or before the run instant', () => {
    const entries: WeightEntry[] = [
      { dateUnix: 100, date: new Date(100_000).toISOString(), kg: 80 },
      { dateUnix: 200, date: new Date(200_000).toISOString(), kg: 79 },
      { dateUnix: 300, date: new Date(300_000).toISOString(), kg: 78 },
    ]
    expect(weightKgAtOrBeforeRunUnix(entries, 200)).toBe(79)
    expect(weightKgAtOrBeforeRunUnix(entries, 250)).toBe(79)
    expect(weightKgAtOrBeforeRunUnix(entries, 300)).toBe(78)
    expect(weightKgAtOrBeforeRunUnix(entries, 99)).toBeNull()
  })

  it('uses a morning weigh-in for an afternoon run on the same day (dateUnix ordering)', () => {
    const morning = new Date('2026-04-11T07:00:00.000Z').getTime() / 1000
    const afternoonRun = new Date('2026-04-11T18:00:00.000Z').getTime() / 1000
    const entries: WeightEntry[] = [
      { dateUnix: morning, date: new Date(morning * 1000).toISOString(), kg: 71 },
    ]
    expect(weightKgAtOrBeforeRunUnix(entries, afternoonRun)).toBe(71)
  })
})

describe('weightKgByRunDateKeysFromEntries', () => {
  it('matches naive scan for sorted unique keys and ascending weight rows', () => {
    const sorted: WeightEntry[] = [
      { dateUnix: 1, date: '2026-01-01T08:00:00.000Z', kg: 80 },
      { dateUnix: 2, date: '2026-02-01T08:00:00.000Z', kg: 79 },
      { dateUnix: 3, date: '2026-03-15T08:00:00.000Z', kg: 78 },
    ]
    const keys = ['2026-01-10T12:00:00.000Z', '2026-02-01T08:00:00.000Z', '2026-04-01T12:00:00.000Z'].sort((a, b) =>
      a.localeCompare(b),
    )
    const fast = weightKgByRunDateKeysFromEntries(keys, sorted)
    const slow = naiveWeightMap(keys, sorted)
    expect(fast.get('2026-01-10T12:00:00.000Z')).toBe(slow.get('2026-01-10T12:00:00.000Z'))
    expect(fast.get('2026-02-01T08:00:00.000Z')).toBe(slow.get('2026-02-01T08:00:00.000Z'))
    expect(fast.get('2026-04-01T12:00:00.000Z')).toBe(slow.get('2026-04-01T12:00:00.000Z'))
  })
})
