import { describe, expect, it } from 'vitest'
import { computeGoalProbability } from './goalProbabilityEngine'

describe('computeGoalProbability', () => {
  it('returns null without goal progress', () => {
    expect(
      computeGoalProbability({
        prediction: null,
        readiness: null,
        simulation: null,
        timeline: null,
        goalProgress: null,
        memory: null,
      })
    ).toBeNull()
  })

  it('returns clamped probability and one-line summary', () => {
    const r = computeGoalProbability({
      prediction: {
        direction: 'improving',
        confidence: 0.9,
        projectedKps7d: 100,
        projectedKps28d: 105,
        message: '',
      },
      readiness: {
        score: 88,
        status: 'peak',
        components: { fatigue: 20, loadRisk: 18, predictionTrend: 18, phaseAlignment: 16, goalProximity: 16 },
        summary: '',
      },
      simulation: { projectedFinishSeconds: 3000, splits: [], fadeRisk: 'low', pacingRecommendation: '' },
      timeline: {
        projection: { anchorDate: '2026-01-01', minHorizonDays: 7, maxHorizonDays: 28 },
        events: [
          { type: 'peak_window', targetDate: '2026-01-15', dayOffset: 14, title: '', detail: '', priority: 80 },
        ],
      },
      goalProgress: {
        daysRemaining: 40,
        projectedTimeSeconds: 3600,
        targetDeltaSeconds: -120,
        status: 'ahead',
        weeklyEmphasis: 'quality',
      },
      memory: {
        history: [],
        latest: { date: '2026-01-01', decision: 'build_progression', confidence: 'high', reasonSummary: '' },
        trendSummary: '',
      },
    })
    expect(r).not.toBeNull()
    expect(r!.probability).toBeGreaterThanOrEqual(0)
    expect(r!.probability).toBeLessThanOrEqual(100)
    expect(['low', 'medium', 'high']).toContain(r!.confidence)
    expect(r!.summary.includes('\n')).toBe(false)
  })
})
