import { describe, expect, it } from 'vitest'
import { buildCalendarDates, __testables as layoutTestables } from './calendarLayout'
import { computeTrainingCalendar } from './calendarEngine'
import type { TrainingCalendarInputs } from './types'

const baseInputs: TrainingCalendarInputs = {
  trainingPlan: {
    today: { sessionType: 'easy', durationMinutes: 40, intensity: 'low', rationale: '' },
    week: Array.from({ length: 7 }, (_, dayOffset) => ({
      dayOffset,
      label: `Day ${dayOffset + 1}`,
      sessionType: dayOffset === 0 ? 'easy' : dayOffset === 1 ? 'tempo' : 'recovery',
      durationMinutes: dayOffset === 6 ? null : 30 + dayOffset * 5,
      intensity: dayOffset === 1 ? 'moderate-high' : 'low',
    })),
    weeklyEmphasis: 'build',
  },
  periodization: { phase: 'build', weeksRemaining: 5, nextPhase: 'peak', focus: '' },
  goalProgress: null,
  coach: { decision: 'build_progression', reason: '', confidence: 'medium' },
  loadControl: { currentWeeklyLoad: 48, rampRate: 4, riskLevel: 'moderate', recommendedLoad: 47, recommendation: '' },
  now: new Date('2026-04-09T23:30:00.000Z'),
}

describe('training calendar', () => {
  it('builds deterministic 7-day date layout', () => {
    const dates = buildCalendarDates(new Date('2026-04-09T23:30:00.000Z'), 7)
    expect(dates).toHaveLength(7)
    expect(dates[0].date).toBe('2026-04-09')
    expect(dates[6].date).toBe('2026-04-15')
  })

  it('renders sessions from training plan', () => {
    const result = computeTrainingCalendar(baseInputs)
    expect(result.days).toHaveLength(7)
    expect(result.days[1].sessionType).toBe('tempo')
  })

  it('falls back safely when plan is missing', () => {
    const result = computeTrainingCalendar({ ...baseInputs, trainingPlan: null })
    expect(result.horizonDays).toBe(7)
    expect(result.days).toHaveLength(0)
  })

  it('applies note annotations deterministically', () => {
    const result = computeTrainingCalendar(baseInputs)
    expect(result.days[0].note).toBe('Load-controlled easy day')
  })

  it('uses UTC-safe day increments', () => {
    const nextDay = layoutTestables.addDaysUtc(new Date('2026-04-09T23:59:59.000Z'), 1)
    expect(nextDay.toISOString().slice(0, 10)).toBe('2026-04-10')
  })
})
