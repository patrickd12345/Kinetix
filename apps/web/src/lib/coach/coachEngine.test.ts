import { describe, expect, it } from 'vitest'
import { computeCoachDecision } from './coachEngine'

const baseInput = {
  loadControl: {
    currentWeeklyLoad: 45,
    rampRate: 5,
    riskLevel: 'low' as const,
    recommendedLoad: 47,
    recommendation: '',
  },
  periodization: {
    phase: 'build' as const,
    weeksRemaining: 8,
    nextPhase: 'peak' as const,
    focus: '',
  },
  prediction: {
    direction: 'improving' as const,
    confidence: 0.8,
    projectedKps7d: 95,
    projectedKps28d: 98,
    message: '',
  },
  fatigue: {
    level: 'low' as const,
    message: '',
  },
  goal: {
    distance: 'Half' as const,
    eventDate: '2026-12-20T12:00:00.000Z',
    priority: 'improve' as const,
  },
}

describe('computeCoachDecision', () => {
  it('applies load risk override', () => {
    const result = computeCoachDecision({
      ...baseInput,
      loadControl: { ...baseInput.loadControl, riskLevel: 'high' },
    })
    expect(result.decision).toBe('recovery_week')
  })

  it('applies taper override', () => {
    const result = computeCoachDecision({
      ...baseInput,
      periodization: { ...baseInput.periodization, phase: 'taper', weeksRemaining: 1, nextPhase: null },
    })
    expect(result.decision).toBe('taper')
  })

  it('selects build progression when build + improving + low risk', () => {
    const result = computeCoachDecision(baseInput)
    expect(result.decision).toBe('build_progression')
  })

  it('triggers recovery logic on high fatigue', () => {
    const result = computeCoachDecision({
      ...baseInput,
      fatigue: { level: 'high', message: '' },
    })
    expect(result.decision).toBe('recovery_week')
  })
})
