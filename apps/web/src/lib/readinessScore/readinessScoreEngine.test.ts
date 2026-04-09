import { describe, expect, it } from 'vitest'
import { computeRaceReadiness, __testables } from './readinessScoreEngine'
import type { RaceReadinessInputs } from './types'

const baseInputs: RaceReadinessInputs = {
  fatigue: { level: 'low', message: '' },
  loadControl: {
    currentWeeklyLoad: 50,
    rampRate: 4,
    riskLevel: 'low',
    recommendedLoad: 52,
    recommendation: '',
  },
  prediction: {
    direction: 'stable',
    confidence: 0.8,
    projectedKps7d: 95,
    projectedKps28d: 96,
    message: '',
  },
  periodization: {
    phase: 'build',
    weeksRemaining: 4,
    nextPhase: 'peak',
    focus: '',
  },
  goalProgress: {
    daysRemaining: 30,
    projectedTimeSeconds: 2400,
    targetDeltaSeconds: -20,
    status: 'on_track',
    weeklyEmphasis: 'build',
  },
}

describe('computeRaceReadiness', () => {
  it('fatigue lowers score', () => {
    const lowFatigue = computeRaceReadiness(baseInputs)
    const highFatigue = computeRaceReadiness({
      ...baseInputs,
      fatigue: { level: 'high', message: '' },
    })
    expect(highFatigue.score).toBeLessThan(lowFatigue.score)
  })

  it('improving prediction raises score', () => {
    const stable = computeRaceReadiness(baseInputs)
    const improving = computeRaceReadiness({
      ...baseInputs,
      prediction: { ...baseInputs.prediction!, direction: 'improving' },
    })
    expect(improving.score).toBeGreaterThan(stable.score)
  })

  it('taper phase near event improves phase alignment', () => {
    const build = computeRaceReadiness(baseInputs)
    const taper = computeRaceReadiness({
      ...baseInputs,
      goalProgress: { ...baseInputs.goalProgress!, daysRemaining: 14 },
      periodization: { ...baseInputs.periodization, phase: 'taper', weeksRemaining: 2, nextPhase: null },
    })
    expect(taper.components.phaseAlignment).toBeGreaterThan(build.components.phaseAlignment)
  })

  it('score is clamped between 0 and 100', () => {
    expect(__testables.clamp(180, 0, 100)).toBe(100)
    expect(__testables.clamp(-10, 0, 100)).toBe(0)
  })

  it('maps status from score bands', () => {
    expect(__testables.mapStatus(95)).toBe('peak')
    expect(__testables.mapStatus(75)).toBe('ready')
    expect(__testables.mapStatus(55)).toBe('building')
    expect(__testables.mapStatus(40)).toBe('recovery')
  })
})
