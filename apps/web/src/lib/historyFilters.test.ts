import { describe, it, expect } from 'vitest'
import {
  runMatchesHistoryFilters,
  draftToRunHistoryFilters,
  applyDistanceUnitToFilters,
  emptyRunHistoryFilterDraft,
  getPageForDateInDescendingList,
  runDisplayTitle,
  hasActiveRunHistoryFilters,
  hasKpsBoundsInFilters,
  moveRunIdToFront,
} from './historyFilters'
import type { RunRecord } from './database'

const baseRun = (): RunRecord => ({
  date: '2026-04-01T10:00:00.000Z',
  distance: 5000,
  duration: 1800,
  averagePace: 360,
  targetKPS: 100,
  locations: [],
  splits: [],
  notes: 'Morning Run',
  source: 'strava',
})

describe('runMatchesHistoryFilters', () => {
  it('matches name substring case-insensitively', () => {
    const r = baseRun()
    expect(runMatchesHistoryFilters(r, { nameContains: 'morning' })).toBe(true)
    expect(runMatchesHistoryFilters(r, { nameContains: 'night' })).toBe(false)
  })

  it('filters by pace bounds (sec/km)', () => {
    const r = { ...baseRun(), averagePace: 240 }
    expect(runMatchesHistoryFilters(r, { paceMinSecPerKm: 180, paceMaxSecPerKm: 300 })).toBe(true)
    expect(runMatchesHistoryFilters(r, { paceMinSecPerKm: 300 })).toBe(false)
  })

  it('filters by source case-insensitively', () => {
    const r = baseRun()
    expect(runMatchesHistoryFilters(r, { sourceEquals: 'STRAVA' })).toBe(true)
    expect(runMatchesHistoryFilters(r, { sourceEquals: 'garmin' })).toBe(false)
  })
})

describe('draftToRunHistoryFilters', () => {
  it('converts metric pace and distance', () => {
    const d = emptyRunHistoryFilterDraft()
    d.paceFastestMin = '3'
    d.paceSlowestMin = '12'
    d.distanceMin = '2'
    d.distanceMax = '21'
    const f = applyDistanceUnitToFilters(draftToRunHistoryFilters(d, 'min/km'), 'metric')
    expect(f.paceMinSecPerKm).toBe(180)
    expect(f.paceMaxSecPerKm).toBe(720)
    expect(f.distanceMinM).toBe(2000)
    expect(f.distanceMaxM).toBe(21000)
  })

  it('parses KPS bounds and swaps when min > max', () => {
    const d = emptyRunHistoryFilterDraft()
    d.kpsMin = '90'
    d.kpsMax = '50'
    const f = draftToRunHistoryFilters(d, 'min/km')
    expect(f.kpsMin).toBe(50)
    expect(f.kpsMax).toBe(90)
  })
})

describe('hasActiveRunHistoryFilters / hasKpsBoundsInFilters', () => {
  it('treats only KPS bounds as active', () => {
    expect(hasActiveRunHistoryFilters({ kpsMin: 40 })).toBe(true)
    expect(hasKpsBoundsInFilters({ kpsMin: 40 })).toBe(true)
    expect(hasKpsBoundsInFilters({})).toBe(false)
  })
})

describe('moveRunIdToFront', () => {
  it('moves matching run to index 0', () => {
    const a = { ...baseRun(), id: 1, notes: 'a' }
    const b = { ...baseRun(), id: 2, notes: 'b' }
    const c = { ...baseRun(), id: 3, notes: 'c' }
    expect(moveRunIdToFront([a, b, c], 3)).toEqual([c, a, b])
  })

  it('returns same array when id missing or already first', () => {
    const a = { ...baseRun(), id: 1 }
    expect(moveRunIdToFront([a], 99)).toEqual([a])
    expect(moveRunIdToFront([a], 1)).toEqual([a])
  })
})

describe('getPageForDateInDescendingList', () => {
  it('returns 1-based page for date', () => {
    const list: RunRecord[] = [
      { ...baseRun(), date: '2026-04-03T12:00:00.000Z', notes: 'a' },
      { ...baseRun(), date: '2026-04-02T12:00:00.000Z', notes: 'b' },
      { ...baseRun(), date: '2026-04-01T12:00:00.000Z', notes: 'c' },
    ]
    expect(getPageForDateInDescendingList('2026-04-02', 1, list)).toBe(2)
    expect(getPageForDateInDescendingList('2026-04-03', 2, list)).toBe(1)
  })
})

describe('runDisplayTitle', () => {
  it('uses notes or fallback', () => {
    expect(runDisplayTitle({ notes: '  Hello  ' })).toBe('Hello')
    expect(runDisplayTitle({ notes: '' })).toBe('Untitled run')
  })
})
