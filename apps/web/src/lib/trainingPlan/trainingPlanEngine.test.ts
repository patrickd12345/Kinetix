import { describe, expect, it } from 'vitest'
import { computeTrainingPlan } from './trainingPlanEngine'

const baseReadiness = {
  score: 70,
  status: 'moderate' as const,
  message: 'moderate',
}

const baseFatigue = {
  level: 'low' as const,
  message: 'low',
}

describe('computeTrainingPlan', () => {
  it('forces recovery/rest when fatigue is high', () => {
    const plan = computeTrainingPlan({
      readiness: { ...baseReadiness, status: 'high' },
      fatigue: { ...baseFatigue, level: 'high' },
      trend: 3,
      predictionDirection: 'improving',
      prediction: { direction: 'improving', confidence: 0.9, projectedKps7d: 90, projectedKps28d: 92, message: '' },
      recentActivity: { activeDaysLast7d: 6, confidence: 0.9 },
    })

    expect(['recovery', 'rest']).toContain(plan.today.sessionType)
    expect(plan.week.every((session) => ['recovery', 'easy', 'rest'].includes(session.sessionType))).toBe(true)
  })

  it('high readiness + improving trend yields quality recommendation in week', () => {
    const plan = computeTrainingPlan({
      readiness: { ...baseReadiness, status: 'high' },
      fatigue: baseFatigue,
      trend: 4,
      predictionDirection: 'improving',
      prediction: { direction: 'improving', confidence: 0.9, projectedKps7d: 95, projectedKps28d: 98, message: '' },
      recentActivity: { confidence: 0.9, qualitySessionsLast7d: 0, longSessionsLast7d: 0, activeDaysLast7d: 4 },
    })

    const qualityCount = plan.week.filter((session) => ['interval', 'tempo', 'long'].includes(session.sessionType)).length
    expect(qualityCount).toBeGreaterThanOrEqual(1)
  })

  it('declining prediction direction downgrades aggressiveness', () => {
    const plan = computeTrainingPlan({
      readiness: { ...baseReadiness, status: 'high' },
      fatigue: baseFatigue,
      trend: 3,
      predictionDirection: 'declining',
      prediction: { direction: 'declining', confidence: 0.9, projectedKps7d: 80, projectedKps28d: 76, message: '' },
      recentActivity: { confidence: 0.9, qualitySessionsLast7d: 0, longSessionsLast7d: 0 },
    })

    expect(plan.today.sessionType).not.toBe('interval')
  })

  it('prevents back-to-back interval and tempo sessions', () => {
    const plan = computeTrainingPlan({
      readiness: { ...baseReadiness, status: 'high' },
      fatigue: baseFatigue,
      trend: 4,
      predictionDirection: 'improving',
      prediction: { direction: 'improving', confidence: 0.9, projectedKps7d: 95, projectedKps28d: 98, message: '' },
      recentActivity: { confidence: 0.9, qualitySessionsLast7d: 0, longSessionsLast7d: 1 },
    })

    for (let i = 1; i < plan.week.length; i += 1) {
      const prev = plan.week[i - 1].sessionType
      const curr = plan.week[i].sessionType
      const blockedPair =
        (prev === 'interval' && curr === 'tempo') ||
        (prev === 'tempo' && curr === 'interval')
      expect(blockedPair).toBe(false)
    }
  })

  it('schedules long session at most once per week', () => {
    const plan = computeTrainingPlan({
      readiness: { ...baseReadiness, status: 'high' },
      fatigue: baseFatigue,
      trend: 4,
      predictionDirection: 'improving',
      prediction: { direction: 'improving', confidence: 0.9, projectedKps7d: 95, projectedKps28d: 98, message: '' },
      recentActivity: { confidence: 0.9, qualitySessionsLast7d: 0, longSessionsLast7d: 0 },
    })

    const longCount = plan.week.filter((session) => session.sessionType === 'long').length
    expect(longCount).toBeLessThanOrEqual(1)
  })

  it('uses conservative plan when data is sparse/weak', () => {
    const plan = computeTrainingPlan({
      readiness: { ...baseReadiness, status: 'moderate' },
      fatigue: baseFatigue,
      trend: 0,
      predictionDirection: 'unknown',
      prediction: { direction: 'unknown', confidence: 0.2, projectedKps7d: 70, projectedKps28d: 70, message: '' },
      recentActivity: { confidence: 0.2, activeDaysLast7d: 1, qualitySessionsLast7d: 0, volatility: 7 },
    })

    expect(['easy', 'recovery', 'rest', 'long']).toContain(plan.today.sessionType)
  })
})
