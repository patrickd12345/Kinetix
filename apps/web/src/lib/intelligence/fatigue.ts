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

export function computeFatigue(samples: KpsSample[]): FatigueResult {
  const recent = getWindow(samples)
  const values = recent.map((sample) => sample.kps)
  const stdDev = computeStdDev(values)
  const slope = computeSlope(values)

  const isRecentDrop = values.length >= 2 ? values[values.length - 1] < values[0] : false
  const isNegativeSlope = slope < 0

  if (isRecentDrop && isNegativeSlope && stdDev >= HIGH_VOLATILITY_THRESHOLD) {
    return {
      level: 'high',
      message: 'High fatigue detected from recent KPS decline and elevated short-term variability.',
    }
  }

  if ((isRecentDrop && isNegativeSlope) || stdDev >= MODERATE_VOLATILITY_THRESHOLD) {
    return {
      level: 'moderate',
      message: 'Moderate fatigue signals are present. Keep intensity controlled and monitor recovery.',
    }
  }

  return {
    level: 'low',
    message: 'Low fatigue signal. Recent KPS behavior appears stable and manageable.',
  }
}
