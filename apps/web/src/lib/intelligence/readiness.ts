import { computeKpsTrend } from './kpsTrend'
import type { KpsSample, ReadinessResult } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function computeReadiness(samples: KpsSample[]): ReadinessResult {
  const trend = computeKpsTrend(samples)
  const latestKps = samples.length > 0 ? samples[samples.length - 1].kps : 0
  const computedScore = clamp(Math.round(latestKps + trend * 4), 0, 100)

  if (trend > 2) {
    return {
      score: computedScore,
      status: 'high',
      message: 'Readiness is high. Your recent KPS trend supports higher-intensity work.',
    }
  }

  if (trend < -1) {
    return {
      score: computedScore,
      status: 'low',
      message: 'Readiness is low. Consider reducing intensity and prioritizing recovery today.',
    }
  }

  return {
    score: computedScore,
    status: 'moderate',
    message: 'Readiness is moderate. Maintain controlled quality training with good recovery.',
  }
}
