import type { FatigueResult, Recommendation, ReadinessResult } from './types'

export function computeRecommendation(
  readiness: ReadinessResult,
  fatigue: FatigueResult
): Recommendation {
  if (fatigue.level === 'high') {
    return {
      type: 'recovery',
      message: 'Recovery session recommended: easy movement, short duration, and no intensity.',
    }
  }

  if (readiness.status === 'high') {
    return {
      type: 'interval',
      message: 'Interval session recommended: execute high-quality reps with full control.',
    }
  }

  if (readiness.status === 'moderate') {
    return {
      type: 'tempo',
      message: 'Tempo session recommended: steady sustained effort in a controlled threshold range.',
    }
  }

  return {
    type: 'easy',
    message: 'Easy session recommended: keep effort light to support adaptation and consistency.',
  }
}
