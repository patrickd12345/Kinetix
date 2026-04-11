import { describe, expect, it } from 'vitest'
import { weightKgAtOrBeforeRunUnix, type WeightEntry } from './database'

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
