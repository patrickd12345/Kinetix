import type { KpsSample } from '../intelligence/types'
import type { PredictionResult } from './types'
import { computeFatigue } from '../intelligence/fatigue'
import { getCalibration } from '../calibration/calibrationEngine'
import { computeDistancePrediction } from '../calibration/distancePrediction'
import type { Distance } from '../calibration/types'

function linearSlope(values: number[]): number {
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

function volatility(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function computePrediction(samples: KpsSample[], distance: Distance = '10k'): PredictionResult {
  const sorted = [...samples].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const values = sorted.map((sample) => sample.kps).filter((kps) => Number.isFinite(kps))

  if (values.length < 4) {
    return {
      direction: 'unknown',
      confidence: 0.25,
      projectedKps7d: values.at(-1) ?? 0,
      projectedKps28d: values.at(-1) ?? 0,
      message: 'Insufficient data for robust projection. Conservative mode enabled.',
    }
  }

  const recent14 = values.slice(-14)
  const slopePerSession = linearSlope(recent14)
  const current = values[values.length - 1]
  const baseProjectedKps7d = clamp(current + slopePerSession * 3, 0, 130)
  const baseProjectedKps28d = clamp(current + slopePerSession * 10, 0, 130)
  const trend = baseProjectedKps28d - current
  const fatigue = computeFatigue(sorted).level
  const calibrated = computeDistancePrediction(
    distance,
    {
      currentKps: current,
      projectedKps7d: baseProjectedKps7d,
      projectedKps28d: baseProjectedKps28d,
    },
    getCalibration(distance),
    trend,
    fatigue
  )
  const projectedKps7d = calibrated.projectedKps7d
  const projectedKps28d = calibrated.projectedKps28d

  const recentVolatility = volatility(recent14)
  const sampleFactor = Math.min(1, values.length / 30)
  const confidence = clamp(0.35 + sampleFactor * 0.5 - recentVolatility / 30, 0.2, 0.95)

  const delta = projectedKps28d - current
  const direction = delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable'

  return {
    direction,
    confidence,
    projectedKps7d,
    projectedKps28d,
    message:
      direction === 'improving'
        ? 'Projection indicates upward adaptation if current consistency is maintained.'
        : direction === 'declining'
          ? 'Projection indicates possible regression; load should be controlled.'
          : 'Projection is stable; consistent execution should sustain current level.',
  }
}
