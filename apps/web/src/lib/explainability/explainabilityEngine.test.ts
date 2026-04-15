import { describe, expect, it } from 'vitest'
import { computeCoachExplanation } from './explainabilityEngine'

const baseInput = {
  coach: {
    decision: 'build_progression' as const,
    reason: '',
    confidence: 'high' as const,
  },
  loadControl: {
    currentWeeklyLoad: 50,
    rampRate: 6,
    riskLevel: 'low' as const,
    recommendedLoad: 53,
    recommendation: '',
  },
  fatigue: {
    level: 'low' as const,
    message: '',
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
}

describe('computeCoachExplanation', () => {
  it('puts load risk as primary when load risk drives recovery', () => {
    const explanation = computeCoachExplanation({
      ...baseInput,
      coach: { decision: 'recovery_week', reason: '', confidence: 'high' },
      loadControl: { ...baseInput.loadControl, riskLevel: 'high', rampRate: 18 },
      fatigue: { level: 'moderate', message: '' },
      prediction: { ...baseInput.prediction, direction: 'declining' },
    })

    expect(explanation.evidence[0].key).toBe('load_risk')
    expect(explanation.evidence[0].impact).toBe('primary')
  })

  it('includes phase as primary for taper decision', () => {
    const explanation = computeCoachExplanation({
      ...baseInput,
      coach: { decision: 'taper', reason: '', confidence: 'high' },
      periodization: { ...baseInput.periodization, phase: 'taper', weeksRemaining: 1, nextPhase: null },
    })

    expect(explanation.evidence[0].key).toBe('phase')
  })

  it('includes declining prediction when materially influential', () => {
    const explanation = computeCoachExplanation({
      ...baseInput,
      coach: { decision: 'maintain', reason: '', confidence: 'medium' },
      prediction: { ...baseInput.prediction, direction: 'declining' },
      fatigue: { level: 'moderate', message: '' },
      loadControl: { ...baseInput.loadControl, riskLevel: 'moderate' },
    })

    expect(explanation.evidence.some((item) => item.key === 'prediction')).toBe(true)
  })

  it('caps evidence list at 5 items', () => {
    const explanation = computeCoachExplanation({
      ...baseInput,
      coach: { decision: 'taper', reason: '', confidence: 'medium' },
      loadControl: { ...baseInput.loadControl, riskLevel: 'high', rampRate: 19 },
      fatigue: { level: 'high', message: '' },
      prediction: { ...baseInput.prediction, direction: 'declining' },
      periodization: { ...baseInput.periodization, phase: 'taper', weeksRemaining: 1, nextPhase: null },
    })

    expect(explanation.evidence.length).toBeLessThanOrEqual(5)
  })

  it('uses deterministic summary phrasing', () => {
    const explanation = computeCoachExplanation({
      ...baseInput,
      coach: { decision: 'build_progression', reason: '', confidence: 'high' },
    })
    expect(explanation.summary).toBe(
      'Build progression continues because risk is controlled and trend supports progression.'
    )
  })

  it('mirrors actual coach decision without drift', () => {
    const explanation = computeCoachExplanation({
      ...baseInput,
      coach: { decision: 'peak', reason: '', confidence: 'medium' },
      periodization: { ...baseInput.periodization, phase: 'peak', weeksRemaining: 3, nextPhase: 'taper' },
    })

    expect(explanation.decision).toBe('peak')
  })
})
