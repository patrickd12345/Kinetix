import type { Distance, DistanceCalibration } from './types'

type FatigueLevel = 'low' | 'moderate' | 'high'

interface BasePrediction {
  currentKps: number
  projectedKps7d: number
  projectedKps28d: number
}

interface DistancePredictionOutput {
  projectedKps7d: number
  projectedKps28d: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function fatigueFactor(level: FatigueLevel): number {
  if (level === 'high') return 1
  if (level === 'moderate') return 0.55
  return 0.2
}

function jumpLimits(distance: Distance): { jump7d: number; jump28d: number } {
  if (distance === '5k') return { jump7d: 8, jump28d: 14 }
  if (distance === '10k') return { jump7d: 7, jump28d: 12 }
  if (distance === 'half') return { jump7d: 6, jump28d: 10 }
  return { jump7d: 5, jump28d: 8 }
}

export function computeDistancePrediction(
  distance: Distance,
  basePrediction: BasePrediction,
  calibration: DistanceCalibration,
  trend: number,
  fatigue: FatigueLevel
): DistancePredictionOutput {
  const trendSignal = trend * calibration.trendSensitivity
  const speedImpact = trendSignal * calibration.speedWeight * 0.6
  const enduranceImpact = trendSignal * calibration.enduranceWeight * 0.75
  const fatigueImpact = fatigueFactor(fatigue) * calibration.fatiguePenalty * 4

  const raw7d = basePrediction.projectedKps7d + speedImpact - fatigueImpact
  const raw28d = basePrediction.projectedKps28d + enduranceImpact - fatigueImpact * 1.15
  const limits = jumpLimits(distance)

  const clamped7d = clamp(
    raw7d,
    basePrediction.currentKps - limits.jump7d,
    basePrediction.currentKps + limits.jump7d
  )
  const clamped28d = clamp(
    raw28d,
    basePrediction.currentKps - limits.jump28d,
    basePrediction.currentKps + limits.jump28d
  )

  return {
    projectedKps7d: clamp(clamped7d, 0, 130),
    projectedKps28d: clamp(clamped28d, 0, 130),
  }
}
