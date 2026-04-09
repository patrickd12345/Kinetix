import type { KpsSample } from './types'

const WINDOW_DAYS = 7

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function computeKpsTrend(samples: KpsSample[]): number {
  if (samples.length === 0) return 0

  const sorted = [...samples]
    .filter((sample) => Number.isFinite(sample.kps))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (sorted.length === 0) return 0

  const lastWindow = sorted.slice(-WINDOW_DAYS)
  const previousWindow = sorted.slice(-WINDOW_DAYS * 2, -WINDOW_DAYS)

  const lastAvg = average(lastWindow.map((sample) => sample.kps))
  const previousAvg = average(previousWindow.map((sample) => sample.kps))

  if (previousWindow.length === 0) {
    return lastAvg
  }

  return lastAvg - previousAvg
}
