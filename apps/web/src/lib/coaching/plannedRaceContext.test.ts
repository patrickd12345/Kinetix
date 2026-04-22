import { describe, it, expect } from 'vitest'
import {
  computeRacePhase,
  getRaceDistanceBucket,
  buildPlannedRaceCoachingContext,
  getDaysToRace,
  toLocalDateString,
  getNextRelevantRace,
} from './plannedRaceContext'
import type { PlannedRace } from '../plannedRaces'

describe('plannedRaceContext', () => {
  describe('computeRacePhase', () => {
    it('returns build for > 42 days', () => {
      expect(computeRacePhase(100)).toBe('build')
    })
    it('returns specific for 15-42 days', () => {
      expect(computeRacePhase(42)).toBe('specific')
      expect(computeRacePhase(15)).toBe('specific')
    })
    it('returns taper for 3-14 days', () => {
      expect(computeRacePhase(14)).toBe('taper')
      expect(computeRacePhase(3)).toBe('taper')
    })
    it('returns race_ready for 0-2 days', () => {
      expect(computeRacePhase(2)).toBe('race_ready')
      expect(computeRacePhase(0)).toBe('race_ready')
    })
    it('returns post_race_recovery for -3 to -1 days', () => {
      expect(computeRacePhase(-1)).toBe('post_race_recovery')
      expect(computeRacePhase(-3)).toBe('post_race_recovery')
    })
    it('returns null for beyond recovery window', () => {
      expect(computeRacePhase(-4)).toBeNull()
    })
  })

  describe('getRaceDistanceBucket', () => {
    it('returns short for < 8000m', () => {
      expect(getRaceDistanceBucket(5000)).toBe('short')
    })
    it('returns medium for 8000-25000m', () => {
      expect(getRaceDistanceBucket(10000)).toBe('medium')
      expect(getRaceDistanceBucket(21097)).toBe('medium')
    })
    it('returns long for > 25000m', () => {
      expect(getRaceDistanceBucket(42195)).toBe('long')
    })
  })

  describe('getDaysToRace', () => {
    it('calculates days deterministically avoiding timezone drift', () => {
      expect(getDaysToRace('2026-05-10', '2026-05-01')).toBe(9)
      expect(getDaysToRace('2026-05-01', '2026-05-10')).toBe(-9)
      expect(getDaysToRace('2026-05-01', '2026-05-01')).toBe(0)
    })
  })

  describe('toLocalDateString', () => {
    it('formats a Date into YYYY-MM-DD', () => {
      // Create a date in local time
      const date = new Date(2026, 4, 1) // Month is 0-indexed, so 4 = May
      expect(toLocalDateString(date)).toBe('2026-05-01')
    })
  })

  describe('getNextRelevantRace', () => {
    const today = '2026-05-01'

    it('returns null when no races exist', () => {
      expect(getNextRelevantRace([], today)).toBeNull()
    })

    it('selects the nearest future race, ignoring past races beyond recovery', () => {
      const races: PlannedRace[] = [
        { id: '1', profile_id: '1', race_name: 'Past', race_date: '2026-04-01', distance_meters: 5000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' },
        { id: '2', profile_id: '1', race_name: 'Future', race_date: '2026-06-01', distance_meters: 5000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' },
        { id: '3', profile_id: '1', race_name: 'Far Future', race_date: '2026-12-01', distance_meters: 5000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' },
      ]
      const next = getNextRelevantRace(races, today)
      expect(next?.race_name).toBe('Future')
    })

    it('selects the longer distance if two races are on the same day', () => {
      const races: PlannedRace[] = [
        { id: '1', profile_id: '1', race_name: 'Short', race_date: '2026-06-01', distance_meters: 5000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' },
        { id: '2', profile_id: '1', race_name: 'Long', race_date: '2026-06-01', distance_meters: 10000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' },
      ]
      const next = getNextRelevantRace(races, today)
      expect(next?.race_name).toBe('Long')
    })

    it('includes a past race if it is within the 3-day recovery window', () => {
      const races: PlannedRace[] = [
        { id: '1', profile_id: '1', race_name: 'Recent Past', race_date: '2026-04-29', distance_meters: 42195, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' },
        { id: '2', profile_id: '1', race_name: 'Future', race_date: '2026-06-01', distance_meters: 5000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' },
      ]
      const next = getNextRelevantRace(races, today)
      expect(next?.race_name).toBe('Recent Past')
    })
  })

  describe('buildPlannedRaceCoachingContext', () => {
    const today = '2026-05-01'

    it('returns empty context when nextRace is null', () => {
      const ctx = buildPlannedRaceCoachingContext(null, today)
      expect(ctx.hasUpcomingRace).toBe(false)
      expect(ctx.phase).toBeNull()
      expect(ctx.guidance).toEqual([])
    })

    it('Example 1: 5K in 60 days', () => {
      const race: PlannedRace = { id: '1', profile_id: '1', race_name: '5K', race_date: '2026-06-30', distance_meters: 5000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' }
      const ctx = buildPlannedRaceCoachingContext(race, today)

      expect(ctx.hasUpcomingRace).toBe(true)
      expect(ctx.phase).toBe('build')
      expect(ctx.intensityAdjustment).toBe('normal')
      expect(ctx.daysToRace).toBe(60)
      expect(ctx.guidance[0]).toContain('speed economy')
    })

    it('Example 2: 10K in 28 days', () => {
      const race: PlannedRace = { id: '1', profile_id: '1', race_name: '10K', race_date: '2026-05-29', distance_meters: 10000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' }
      const ctx = buildPlannedRaceCoachingContext(race, today)

      expect(ctx.hasUpcomingRace).toBe(true)
      expect(ctx.phase).toBe('specific')
      expect(ctx.intensityAdjustment).toBe('sharpen')
      expect(ctx.daysToRace).toBe(28)
      expect(ctx.guidance[0]).toContain('race-specific pace')
    })

    it('Example 3: Half Marathon in 8 days', () => {
      const race: PlannedRace = { id: '1', profile_id: '1', race_name: 'HM', race_date: '2026-05-09', distance_meters: 21097, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' }
      const ctx = buildPlannedRaceCoachingContext(race, today)

      expect(ctx.hasUpcomingRace).toBe(true)
      expect(ctx.phase).toBe('taper')
      expect(ctx.intensityAdjustment).toBe('reduce_volume')
      expect(ctx.daysToRace).toBe(8)
      expect(ctx.guidance[1]).toContain('sustained pace confidence')
    })

    it('Example 4: Marathon in 1 day', () => {
      const race: PlannedRace = { id: '1', profile_id: '1', race_name: 'Marathon', race_date: '2026-05-02', distance_meters: 42195, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' }
      const ctx = buildPlannedRaceCoachingContext(race, today)

      expect(ctx.hasUpcomingRace).toBe(true)
      expect(ctx.phase).toBe('race_ready')
      expect(ctx.intensityAdjustment).toBe('reduce_intensity')
      expect(ctx.daysToRace).toBe(1)
      expect(ctx.guidance[1]).toContain('easy runs')
    })

    it('Example 5: Race was yesterday', () => {
      const race: PlannedRace = { id: '1', profile_id: '1', race_name: 'Past Race', race_date: '2026-04-30', distance_meters: 5000, goal_time_seconds: null, notes: null, created_at: '', updated_at: '' }
      const ctx = buildPlannedRaceCoachingContext(race, today)

      expect(ctx.hasUpcomingRace).toBe(true)
      expect(ctx.phase).toBe('post_race_recovery')
      expect(ctx.intensityAdjustment).toBe('recover')
      expect(ctx.daysToRace).toBe(-1)
      expect(ctx.guidance[0]).toContain('easy movement')
    })
  })
})
