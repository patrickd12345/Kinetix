import { computeFatigue } from './fatigue'
import { computeKpsTrend } from './kpsTrend'
import { computeReadiness } from './readiness'
import { computeRecommendation } from './recommendations'
import type { IntelligenceResult, KpsSample } from './types'

export function computeIntelligence(samples: KpsSample[]): IntelligenceResult {
  const trend = computeKpsTrend(samples)
  const readiness = computeReadiness(samples)
  const fatigue = computeFatigue(samples)
  const recommendation = computeRecommendation(readiness, fatigue)

  // TODO: AI coaching layer that adapts guidance to user context and goals.
  // TODO: Performance prediction models for short- and medium-term KPS forecasting.
  // TODO: Injury risk estimation combining workload, volatility, and recovery markers.
  // TODO: Long-term planning engine for periodization and progressive load management.

  return {
    readiness,
    fatigue,
    recommendation,
    trend,
  }
}
