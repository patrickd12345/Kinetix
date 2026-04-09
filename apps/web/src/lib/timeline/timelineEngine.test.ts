import { describe, expect, it } from 'vitest'
import { computeCoachingTimeline } from './timelineEngine'
import type { TimelineEngineInput } from './types'

const anchorApril = new Date(2026, 3, 9, 10, 0, 0)

function baseInput(over: Partial<TimelineEngineInput> = {}): TimelineEngineInput {
  return {
    anchorDate: anchorApril,
    prediction: null,
    readiness: null,
    simulation: null,
    trainingPlan: null,
    periodization: {
      phase: 'base',
      weeksRemaining: 8,
      nextPhase: 'build',
      focus: 'aerobic',
    },
    loadControl: {
      currentWeeklyLoad: 40,
      rampRate: 5,
      riskLevel: 'low',
      recommendedLoad: 42,
      recommendation: '',
    },
    fatigue: { level: 'low', message: '' },
    intelligence: {
      readiness: { score: 70, status: 'moderate', message: '' },
      fatigue: { level: 'low', message: '' },
      recommendation: { type: 'easy', message: '' },
      trend: 0,
    },
    goalProgress: null,
    memory: null,
    ...over,
  }
}

describe('computeCoachingTimeline', () => {
  it('is deterministic for the same inputs', () => {
    const a = computeCoachingTimeline(
      baseInput({
        prediction: {
          direction: 'improving',
          confidence: 0.5,
          projectedKps7d: 98,
          projectedKps28d: 101,
          message: '',
        },
        goalProgress: {
          daysRemaining: 21,
          projectedTimeSeconds: 3600,
          targetDeltaSeconds: -120,
          status: 'ahead',
          weeklyEmphasis: 'quality',
        },
      })
    )
    const b = computeCoachingTimeline(
      baseInput({
        prediction: {
          direction: 'improving',
          confidence: 0.5,
          projectedKps7d: 98,
          projectedKps28d: 101,
          message: '',
        },
        goalProgress: {
          daysRemaining: 21,
          projectedTimeSeconds: 3600,
          targetDeltaSeconds: -120,
          status: 'ahead',
          weeklyEmphasis: 'quality',
        },
      })
    )
    expect(a).toEqual(b)
  })

  it('returns at most 3 events', () => {
    const r = computeCoachingTimeline(
      baseInput({
        loadControl: {
          currentWeeklyLoad: 60,
          rampRate: 20,
          riskLevel: 'high',
          recommendedLoad: 50,
          recommendation: '',
        },
        fatigue: { level: 'high', message: '' },
        simulation: {
          projectedFinishSeconds: 4000,
          splits: [],
          fadeRisk: 'high',
          pacingRecommendation: '',
        },
        prediction: {
          direction: 'improving',
          confidence: 0.6,
          projectedKps7d: 97,
          projectedKps28d: 100,
          message: '',
        },
        goalProgress: {
          daysRemaining: 14,
          projectedTimeSeconds: null,
          targetDeltaSeconds: null,
          status: 'ahead',
          weeklyEmphasis: 'taper',
        },
        periodization: { phase: 'taper', weeksRemaining: 2, nextPhase: null, focus: 'race' },
        readiness: {
          score: 82,
          status: 'peak',
          components: { fatigue: 10, loadRisk: 10, predictionTrend: 15, phaseAlignment: 12, goalProximity: 10 },
          summary: '',
        },
        memory: {
          history: [],
          latest: { date: '2026-04-08', decision: 'taper', confidence: 'high', reasonSummary: '' },
          trendSummary: '',
        },
        trainingPlan: {
          today: { sessionType: 'easy', durationMinutes: 40, intensity: 'low', rationale: '' },
          week: [
            { dayOffset: 0, label: 'Mon', sessionType: 'tempo', durationMinutes: 40, intensity: 'high' },
            { dayOffset: 1, label: 'Tue', sessionType: 'interval', durationMinutes: 45, intensity: 'high' },
          ],
          weeklyEmphasis: 'sharp',
        },
      })
    )
    expect(r.events.length).toBeLessThanOrEqual(3)
  })

  it('emits taper_window when goal is 7–28d out', () => {
    const r = computeCoachingTimeline(
      baseInput({
        goalProgress: {
          daysRemaining: 18,
          projectedTimeSeconds: null,
          targetDeltaSeconds: null,
          status: 'on_track',
          weeklyEmphasis: 'build',
        },
      })
    )
    expect(r.events.some((e) => e.type === 'taper_window')).toBe(true)
    for (const e of r.events) {
      expect(e.dayOffset).toBeGreaterThanOrEqual(7)
      expect(e.dayOffset).toBeLessThanOrEqual(28)
    }
  })

  it('emits fatigue_risk when load and fatigue are high', () => {
    const r = computeCoachingTimeline(
      baseInput({
        loadControl: {
          currentWeeklyLoad: 70,
          rampRate: 25,
          riskLevel: 'high',
          recommendedLoad: 55,
          recommendation: '',
        },
        fatigue: { level: 'high', message: 'tired' },
      })
    )
    expect(r.events.some((e) => e.type === 'fatigue_risk')).toBe(true)
  })

  it('emits performance_projection when prediction is improving with confidence', () => {
    const r = computeCoachingTimeline(
      baseInput({
        prediction: {
          direction: 'improving',
          confidence: 0.55,
          projectedKps7d: 96,
          projectedKps28d: 99,
          message: '',
        },
        goalProgress: {
          daysRemaining: 40,
          projectedTimeSeconds: null,
          targetDeltaSeconds: null,
          status: 'ahead',
          weeklyEmphasis: 'quality',
        },
      })
    )
    expect(r.events.some((e) => e.type === 'performance_projection')).toBe(true)
  })
})
