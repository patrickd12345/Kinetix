import { describe, expect, it } from 'vitest'
import { computeCoachAlerts } from './alertEngine'
import type { CoachAlertsInputs } from './types'

const baseInputs: CoachAlertsInputs = {
  coach: { decision: 'build_progression', reason: '', confidence: 'medium' },
  loadControl: {
    currentWeeklyLoad: 50,
    rampRate: 5,
    riskLevel: 'low',
    recommendedLoad: 52,
    recommendation: '',
  },
  prediction: {
    direction: 'improving',
    confidence: 0.85,
    projectedKps7d: 96,
    projectedKps28d: 98,
    message: '',
  },
  intelligence: {
    readiness: { score: 80, status: 'high', message: '' },
    fatigue: { level: 'low', message: '' },
    recommendation: { type: 'easy', message: '' },
    trend: 0.1,
  },
  periodization: { phase: 'build', weeksRemaining: 4, nextPhase: 'peak', focus: '' },
  goal: { distance: '10K', eventDate: new Date(Date.now() + 10 * 86400000).toISOString(), priority: 'improve' },
  readiness: {
    score: 82,
    status: 'ready',
    components: { fatigue: 20, loadRisk: 18, predictionTrend: 18, phaseAlignment: 13, goalProximity: 13 },
    summary: '',
  },
}

describe('computeCoachAlerts', () => {
  it('emits overload alert', () => {
    const result = computeCoachAlerts({
      ...baseInputs,
      loadControl: { ...baseInputs.loadControl!, riskLevel: 'high' },
    })
    expect(result.alerts.some((a) => a.type === 'overload_risk')).toBe(true)
  })

  it('emits recovery alert', () => {
    const result = computeCoachAlerts({
      ...baseInputs,
      intelligence: { ...baseInputs.intelligence!, fatigue: { level: 'high', message: '' } },
    })
    expect(result.alerts.some((a) => a.type === 'recovery_needed')).toBe(true)
  })

  it('emits taper alert', () => {
    const result = computeCoachAlerts({
      ...baseInputs,
      periodization: { ...baseInputs.periodization, phase: 'taper', weeksRemaining: 2, nextPhase: null },
    })
    expect(result.alerts.some((a) => a.type === 'taper_starting')).toBe(true)
  })

  it('emits race-ready alert', () => {
    const result = computeCoachAlerts(baseInputs)
    expect(result.alerts.some((a) => a.type === 'race_ready')).toBe(true)
  })

  it('orders alerts by priority', () => {
    const result = computeCoachAlerts({
      ...baseInputs,
      loadControl: { ...baseInputs.loadControl!, riskLevel: 'high' },
      intelligence: { ...baseInputs.intelligence!, fatigue: { level: 'high', message: '' } },
      periodization: { ...baseInputs.periodization, phase: 'taper', weeksRemaining: 1, nextPhase: null },
    })
    expect(result.alerts[0].priority).toBe('high')
  })

  it('caps alerts at 3', () => {
    const result = computeCoachAlerts({
      ...baseInputs,
      loadControl: { ...baseInputs.loadControl!, riskLevel: 'high' },
      intelligence: { ...baseInputs.intelligence!, fatigue: { level: 'high', message: '' } },
      periodization: { ...baseInputs.periodization, phase: 'taper', weeksRemaining: 1, nextPhase: null },
      coach: { ...baseInputs.coach!, decision: 'recovery_week' },
    })
    expect(result.alerts.length).toBeLessThanOrEqual(3)
  })
})
