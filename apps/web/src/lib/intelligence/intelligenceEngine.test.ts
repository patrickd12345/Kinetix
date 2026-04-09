import { describe, expect, it } from 'vitest'
import { computeKpsTrend } from './kpsTrend'
import { computeReadiness } from './readiness'
import { computeFatigue } from './fatigue'
import { computeRecommendation } from './recommendations'
import { computeIntelligence } from './intelligenceEngine'
import type { KpsSample } from './types'

function samples(values: number[]): KpsSample[] {
  return values.map((kps, index) => ({
    date: new Date(Date.UTC(2026, 3, index + 1)).toISOString(),
    kps,
  }))
}

describe('computeKpsTrend', () => {
  it('calculates difference between last and previous 7-day averages', () => {
    const trend = computeKpsTrend(samples([70, 70, 70, 70, 70, 70, 70, 74, 74, 74, 74, 74, 74, 74]))
    expect(trend).toBe(4)
  })
})

describe('computeReadiness', () => {
  it('returns high readiness when trend is above 2', () => {
    const readiness = computeReadiness(samples([60, 60, 60, 60, 60, 60, 60, 64, 64, 64, 64, 64, 64, 64]))
    expect(readiness.status).toBe('high')
  })

  it('returns low readiness when trend is below -1', () => {
    const readiness = computeReadiness(samples([70, 70, 70, 70, 70, 70, 70, 67, 67, 67, 67, 67, 67, 67]))
    expect(readiness.status).toBe('low')
  })
})

describe('computeFatigue', () => {
  it('returns high fatigue on volatile, negative recent trend', () => {
    const fatigue = computeFatigue(samples([82, 72, 80, 68, 77, 66, 65]))
    expect(fatigue.level).toBe('high')
  })

  it('returns low fatigue on stable progression', () => {
    const fatigue = computeFatigue(samples([68, 69, 70, 70, 71, 71, 72]))
    expect(fatigue.level).toBe('low')
  })
})

describe('computeRecommendation', () => {
  it('prioritizes recovery when fatigue is high', () => {
    const recommendation = computeRecommendation(
      { score: 90, status: 'high', message: 'x' },
      { level: 'high', message: 'y' }
    )
    expect(recommendation.type).toBe('recovery')
  })
})

describe('computeIntelligence', () => {
  it('returns deterministic unified result', () => {
    const result = computeIntelligence(samples([70, 70, 70, 70, 70, 70, 70, 74, 74, 74, 74, 74, 74, 74]))
    expect(result.trend).toBe(4)
    expect(result.readiness.status).toBe('high')
    expect(result.fatigue.level).toBe('low')
    expect(result.recommendation.type).toBe('interval')
  })
})
