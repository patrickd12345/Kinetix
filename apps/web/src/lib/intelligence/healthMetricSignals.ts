import { getCanonicalHealthMetricsForUser } from '../database'

export interface IntelligenceHealthSignals {
  restingHeartRateTrend: number | null
  recentSleepEfficiency: number | null
}

/**
 * Provider-agnostic intelligence adapter.
 * Reads only canonical health metrics so intelligence logic does not branch per provider.
 */
export async function buildIntelligenceHealthSignals(userId: string): Promise<IntelligenceHealthSignals> {
  const metrics = await getCanonicalHealthMetricsForUser(userId)
  const recentHeart = metrics
    .filter((m) => m.family === 'heart' && m.metric.heartRateBpm != null)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .slice(-5)

  const recentSleep = metrics
    .filter((m) => m.family === 'sleep' && m.metric.sleepEfficiencyPct != null)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .slice(-7)

  const avgHeart =
    recentHeart.length > 0
      ? recentHeart.reduce((sum, metric) => sum + Number(metric.metric.heartRateBpm ?? 0), 0) / recentHeart.length
      : null

  const avgSleepEfficiency =
    recentSleep.length > 0
      ? recentSleep.reduce((sum, metric) => sum + Number(metric.metric.sleepEfficiencyPct ?? 0), 0) / recentSleep.length
      : null

  return {
    restingHeartRateTrend: avgHeart,
    recentSleepEfficiency: avgSleepEfficiency,
  }
}
