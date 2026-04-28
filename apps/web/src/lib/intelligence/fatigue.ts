import type { FatigueResult, KpsSample } from './types'

const WINDOW_DAYS = 7
const HIGH_VOLATILITY_THRESHOLD = 6
const MODERATE_VOLATILITY_THRESHOLD = 3.5

function getWindow(samples: KpsSample[]): KpsSample[] {
  return [...samples]
    .filter((sample) => Number.isFinite(sample.kps))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-WINDOW_DAYS)
}

function computeStdDev(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function computeSlope(values: number[]): number {
  if (values.length < 2) return 0

  const n = values.length
  const sumX = (n * (n - 1)) / 2
  const sumY = values.reduce((sum, value) => sum + value, 0)
  const sumXY = values.reduce((sum, value, index) => sum + index * value, 0)
  const sumX2 = values.reduce((sum, _value, index) => sum + index * index, 0)

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return 0

  return (n * sumXY - sumX * sumY) / denominator
}

function computeAcwr(samples: KpsSample[]): number | null {
  const now = new Date().getTime()
  const oneDayMs = 24 * 60 * 60 * 1000

  const recentWindowDays = 7
  const chronicWindowDays = 28

  let acuteLoad = 0
  let chronicLoad = 0

  for (const sample of samples) {
    if (!sample.distance) continue

    // Volume weighted by relative intensity proxy (KPS / 100)
    // Avoid punishing runners if their KPS drops, but weight their hard volume higher.
    const load = sample.distance * (Math.max(sample.kps, 1) / 100)
    const sampleMs = new Date(sample.date).getTime()
    const daysAgo = (now - sampleMs) / oneDayMs

    if (daysAgo <= chronicWindowDays) {
      chronicLoad += load
    }
    if (daysAgo <= recentWindowDays) {
      acuteLoad += load
    }
  }

  const averageChronicWeeklyLoad = chronicLoad / 4 // 28 days = 4 weeks

  // Avoid division by zero for new users
  if (averageChronicWeeklyLoad < 5000) return null // Less than 5km a week base is too low to model

  return acuteLoad / averageChronicWeeklyLoad
}

export function computeFatigue(samples: KpsSample[]): FatigueResult {
  const recent = getWindow(samples)
  const values = recent.map((sample) => sample.kps)
  const stdDev = computeStdDev(values)
  const slope = computeSlope(values)

  const acwr = computeAcwr(samples) ?? 1.0

  const isRecentDrop = values.length >= 2 ? values[values.length - 1] < values[0] : false
  const isNegativeSlope = slope < 0
  const isOvertraining = acwr > 1.5

  if (isOvertraining || (isRecentDrop && isNegativeSlope && stdDev >= HIGH_VOLATILITY_THRESHOLD)) {
    return {
      level: 'high',
      message: isOvertraining
        ? `High fatigue detected. Your Acute-to-Chronic Workload Ratio (${acwr.toFixed(2)}) indicates an injury risk spike. Reduce volume immediately.`
        : 'High fatigue detected from recent KPS decline and elevated short-term variability.',
      acwr,
    }
  }

  if (acwr > 1.3 || (isRecentDrop && isNegativeSlope) || stdDev >= MODERATE_VOLATILITY_THRESHOLD) {
    return {
      level: 'moderate',
      message: 'Moderate fatigue signals are present. Keep intensity controlled and monitor recovery.',
      acwr,
    }
  }

  return {
    level: 'low',
    message: 'Low fatigue signal. Recent KPS behavior and training load appear stable and manageable.',
    acwr,
  }
}
