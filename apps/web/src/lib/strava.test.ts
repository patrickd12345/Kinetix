/**
 * Strava sync tests: convertStravaToRunRecord and syncStravaRuns (mocked fetch).
 * Run with: pnpm test (from repo root or apps/web).
 */
import { describe, it, expect, vi } from 'vitest'
import type { StravaActivity } from './strava'
import { convertStravaToRunRecord, syncStravaRuns } from './strava'
import type { UserProfile } from '@kinetix/core'

const mockUserProfile: UserProfile = {
  age: 35,
  weightKg: 70,
}

const todayISO = new Date().toISOString().slice(0, 10)

function stravaActivity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 12345,
    name: 'Morning Run',
    type: 'Run',
    distance: 5000,
    moving_time: 1500,
    elapsed_time: 1520,
    total_elevation_gain: 50,
    start_date_local: `${todayISO}T08:00:00Z`,
    start_latlng: null,
    end_latlng: null,
    average_speed: 3.33,
    max_speed: 4.0,
    start_date: `${todayISO}T08:00:00Z`,
    ...overrides,
  }
}

describe('convertStravaToRunRecord', () => {
  it('returns a RunRecord for a valid Run activity', () => {
    const activity = stravaActivity()
    const run = convertStravaToRunRecord(activity, mockUserProfile, 135)
    expect(run).not.toBeNull()
    expect(run!.date).toBe(activity.start_date)
    expect(run!.distance).toBe(5000)
    expect(run!.duration).toBe(1500)
    expect(run!.source).toBe('strava')
    expect(run!.weightKg).toBe(mockUserProfile.weightKg)
  })

  it('uses start_date so today runs have today in date', () => {
    const activity = stravaActivity({ start_date: `${todayISO}T07:30:00Z` })
    const run = convertStravaToRunRecord(activity, mockUserProfile, 135)
    expect(run).not.toBeNull()
    expect(run!.date).toContain(todayISO)
  })

  it('returns null for zero distance', () => {
    const activity = stravaActivity({ distance: 0 })
    const run = convertStravaToRunRecord(activity, mockUserProfile, 135)
    expect(run).toBeNull()
  })

  it('returns null for zero duration', () => {
    const activity = stravaActivity({ moving_time: 0 })
    const run = convertStravaToRunRecord(activity, mockUserProfile, 135)
    expect(run).toBeNull()
  })
})

describe('syncStravaRuns', () => {
  it('returns added: [] when token is empty', async () => {
    const result = await syncStravaRuns('', 135)
    expect(result.added).toEqual([])
  })

  it('returns added: [] when token is whitespace', async () => {
    const result = await syncStravaRuns('   ', 135)
    expect(result.added).toEqual([])
  })

  it('when fetch returns no activities, returns added: [] and does not throw', async () => {
    const originalFetch = globalThis.fetch
    const fetchCalls: string[] = []
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      fetchCalls.push(url)
      if (url.includes('strava') && url.includes('activities')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
      }
      return originalFetch(input)
    }) as typeof fetch

    const result = await syncStravaRuns('fake-token', 135)

    globalThis.fetch = originalFetch
    expect(result.added).toEqual([])
    expect(fetchCalls.some((u) => u.includes('activities'))).toBe(true)
  })

  it('when fetch returns one run activity, sync fetches and returns result (adds or errors when no IndexedDB)', async () => {
    const todayRun = stravaActivity()
    const originalFetch = globalThis.fetch
    let fetchCallCount = 0
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('strava') && url.includes('activities')) {
        fetchCallCount++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([todayRun]),
        } as Response)
      }
      return originalFetch(input)
    }) as typeof fetch

    const result = await syncStravaRuns('fake-token', 135)

    globalThis.fetch = originalFetch
    expect(fetchCallCount).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(result.added)).toBe(true)
    if (result.added.length > 0) {
      expect(result.added[0].date).toContain(todayISO)
      expect(result.added[0].source).toBe('strava')
    }
    if (result.error) {
      expect(result.added).toEqual([])
    }
  })
})
