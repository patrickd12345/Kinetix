import { describe, expect, it } from 'vitest'
import {
  buildSummary,
  clampProbability,
  confidenceFromCoverage,
  coverageCount,
  rawGoalProbabilityScore,
  resolveDirection,
} from './probabilityModel'

describe('clampProbability', () => {
  it('clamps to 0–100', () => {
    expect(clampProbability(-5)).toBe(0)
    expect(clampProbability(150)).toBe(100)
    expect(clampProbability(47.4)).toBe(47)
  })
})

describe('rawGoalProbabilityScore', () => {
  it('is deterministic for same inputs', () => {
    const gp = {
      daysRemaining: 30,
      projectedTimeSeconds: 3600,
      targetDeltaSeconds: -60,
      status: 'on_track' as const,
      weeklyEmphasis: 'build',
    }
    const a = rawGoalProbabilityScore({
      goalProgress: gp,
      prediction: {
        direction: 'improving',
        confidence: 0.5,
        projectedKps7d: 98,
        projectedKps28d: 100,
        message: '',
      },
      readiness: {
        score: 72,
        status: 'ready',
        components: { fatigue: 10, loadRisk: 10, predictionTrend: 12, phaseAlignment: 10, goalProximity: 10 },
        summary: '',
      },
      simulation: { projectedFinishSeconds: 4000, splits: [], fadeRisk: 'low', pacingRecommendation: '' },
      timeline: { projection: { anchorDate: '2026-04-09', minHorizonDays: 7, maxHorizonDays: 28 }, events: [] },
      memory: { history: [], latest: { date: '2026-04-01', decision: 'maintain', confidence: 'medium', reasonSummary: '' }, trendSummary: '' },
    })
    const b = rawGoalProbabilityScore({
      goalProgress: gp,
      prediction: {
        direction: 'improving',
        confidence: 0.5,
        projectedKps7d: 98,
        projectedKps28d: 100,
        message: '',
      },
      readiness: {
        score: 72,
        status: 'ready',
        components: { fatigue: 10, loadRisk: 10, predictionTrend: 12, phaseAlignment: 10, goalProximity: 10 },
        summary: '',
      },
      simulation: { projectedFinishSeconds: 4000, splits: [], fadeRisk: 'low', pacingRecommendation: '' },
      timeline: { projection: { anchorDate: '2026-04-09', minHorizonDays: 7, maxHorizonDays: 28 }, events: [] },
      memory: { history: [], latest: { date: '2026-04-01', decision: 'maintain', confidence: 'medium', reasonSummary: '' }, trendSummary: '' },
    })
    expect(a).toBe(b)
  })
})

describe('coverageCount & confidenceFromCoverage', () => {
  it('maps coverage to confidence bands', () => {
    expect(confidenceFromCoverage(0)).toBe('low')
    expect(confidenceFromCoverage(2)).toBe('low')
    expect(confidenceFromCoverage(3)).toBe('medium')
    expect(confidenceFromCoverage(4)).toBe('medium')
    expect(confidenceFromCoverage(5)).toBe('high')
  })

  it('counts non-null signal layers', () => {
    expect(
      coverageCount({
        prediction: { direction: 'stable', confidence: 0.4, projectedKps7d: 95, projectedKps28d: 95, message: '' },
        readiness: null,
        simulation: null,
        timeline: null,
        memory: null,
      })
    ).toBe(1)
    expect(
      coverageCount({
        prediction: null,
        readiness: { score: 50, status: 'building', components: { fatigue: 0, loadRisk: 0, predictionTrend: 0, phaseAlignment: 0, goalProximity: 0 }, summary: '' },
        simulation: null,
        timeline: { projection: { anchorDate: 'x', minHorizonDays: 7, maxHorizonDays: 28 }, events: [{ type: 'peak_window', targetDate: 'x', dayOffset: 10, title: '', detail: '', priority: 1 }] },
        memory: { history: [], latest: { date: 'd', decision: 'peak', confidence: 'high', reasonSummary: '' }, trendSummary: '' },
      })
    ).toBe(3)
  })
})

describe('resolveDirection', () => {
  it('prefers prediction when not unknown', () => {
    expect(
      resolveDirection(
        { direction: 'declining', confidence: 0.5, projectedKps7d: 90, projectedKps28d: 88, message: '' },
        { daysRemaining: 20, projectedTimeSeconds: null, targetDeltaSeconds: null, status: 'ahead', weeklyEmphasis: '' }
      )
    ).toBe('declining')
  })

  it('falls back to goal status when prediction unknown', () => {
    expect(
      resolveDirection(
        { direction: 'unknown', confidence: 0.2, projectedKps7d: 90, projectedKps28d: 90, message: '' },
        { daysRemaining: 20, projectedTimeSeconds: null, targetDeltaSeconds: null, status: 'behind', weeklyEmphasis: '' }
      )
    ).toBe('declining')
  })
})

describe('buildSummary', () => {
  it('returns a single sentence', () => {
    const s = buildSummary(55, 'stable')
    expect(s.includes('\n')).toBe(false)
    expect(s.length).toBeGreaterThan(10)
  })
})
