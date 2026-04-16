import { describe, expect, it } from 'vitest'
import { adjustLoad } from './loadAdjustment'
import { computeLoadControl } from './loadControlEngine'
import { classifyRampRisk, computeRampRate } from './rampRate'
import { detectLoadRisk } from './riskDetection'

describe('load control', () => {
  it('detects ramp rate thresholds', () => {
    const low = computeRampRate([40, 40, 40, 42]).rampRate
    const moderate = computeRampRate([40, 40, 40, 44]).rampRate
    const high = computeRampRate([40, 40, 40, 46]).rampRate

    expect(classifyRampRisk(low)).toBe('low')
    expect(classifyRampRisk(moderate)).toBe('moderate')
    expect(classifyRampRisk(high)).toBe('high')
  })

  it('classifies risk using ramp + fatigue + prediction', () => {
    const risk = detectLoadRisk({
      rampRate: 10,
      fatigue: { level: 'moderate', message: '' },
      predictionDirection: 'declining',
    })
    expect(risk).toBe('high')
  })

  it('reduces load when risk is high', () => {
    const adjusted = adjustLoad({
      currentWeeklyLoad: 60,
      riskLevel: 'high',
      phase: 'build',
    })
    expect(adjusted.recommendedLoad).toBeLessThan(60)
  })

  it('clamps load increase to max 10%', () => {
    const adjusted = adjustLoad({
      currentWeeklyLoad: 50,
      riskLevel: 'low',
      phase: 'build',
    })
    expect(adjusted.recommendedLoad).toBeLessThanOrEqual(55)
  })

  it('applies fatigue override to high risk', () => {
    const result = computeLoadControl({
      weeklyLoads: [20, 21, 22, 23],
      fatigue: { level: 'high', message: '' },
      predictionDirection: 'improving',
      phase: 'base',
    })
    expect(result.riskLevel).toBe('high')
  })
})
