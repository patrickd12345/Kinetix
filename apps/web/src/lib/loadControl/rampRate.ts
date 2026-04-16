/**
 * Ramp-rate thresholds (% increase vs prior 3-week average):
 * - <= 8%: low
 * - 8-12%: moderate
 * - > 12%: high
 */
export const RAMP_THRESHOLDS = {
  lowMax: 8,
  moderateMax: 12,
} as const

export function computeRampRate(weeklyLoads: number[]): { currentWeeklyLoad: number; rampRate: number } {
  const safeLoads = weeklyLoads.map((value) => Math.max(0, value))
  const currentWeeklyLoad = safeLoads.at(-1) ?? 0
  const prior = safeLoads.slice(0, -1)
  if (prior.length === 0) return { currentWeeklyLoad, rampRate: 0 }

  const priorAverage = prior.reduce((sum, value) => sum + value, 0) / prior.length
  if (priorAverage <= 0) return { currentWeeklyLoad, rampRate: 0 }

  const rampRate = ((currentWeeklyLoad - priorAverage) / priorAverage) * 100
  return { currentWeeklyLoad, rampRate }
}

export function classifyRampRisk(rampRate: number): 'low' | 'moderate' | 'high' {
  if (rampRate <= RAMP_THRESHOLDS.lowMax) return 'low'
  if (rampRate <= RAMP_THRESHOLDS.moderateMax) return 'moderate'
  return 'high'
}
