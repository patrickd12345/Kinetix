import { describe, expect, it } from 'vitest'
import { __testables } from './useKinetixCoachingContext'
import { computeCoachExplanation } from '../lib/explainability/explainabilityEngine'

describe('useKinetixCoachingContext helpers', () => {
  it('aggregates loading deterministically', () => {
    expect(__testables.aggregateLoading([false, false, false])).toBe(false)
    expect(__testables.aggregateLoading([false, true, false])).toBe(true)
  })

  it('aggregates error deterministically', () => {
    expect(__testables.aggregateError([null, undefined, null])).toBeNull()
    expect(__testables.aggregateError([null, 'boom', 'later'])).toBe('boom')
  })

  it('handles null data deterministically', () => {
    expect(__testables.buildNullData()).toEqual({
      coach: null,
      prediction: null,
      loadControl: null,
      goalProgress: null,
      plannedRaceContext: null,
    })
  })

  it('coach + explainability keep identical decision', () => {
    const coach = { decision: 'maintain' as const, reason: '', confidence: 'medium' as const }
    const explanation = computeCoachExplanation({
      coach,
      loadControl: { currentWeeklyLoad: 40, rampRate: 9, riskLevel: 'moderate', recommendedLoad: 38, recommendation: '' },
      fatigue: { level: 'moderate', message: '' },
      periodization: { phase: 'build', weeksRemaining: 7, nextPhase: 'peak', focus: '' },
      prediction: { direction: 'declining', confidence: 0.6, projectedKps7d: 90, projectedKps28d: 88, message: '' },
    })
    expect(explanation.decision).toBe(coach.decision)
  })
})
