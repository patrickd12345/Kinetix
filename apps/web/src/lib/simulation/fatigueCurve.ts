import type { Distance } from '../calibration/types'

interface CurveProfile {
  /** End-of-race fade before fatigue modifiers (e.g. 0.12 => +12% pace at finish). */
  baseFadeAtFinish: number
  /** Higher exponent means fade appears later and then rises more sharply. */
  exponent: number
}

const CURVE_BY_DISTANCE: Record<Distance, CurveProfile> = {
  '5k': { baseFadeAtFinish: 0.02, exponent: 1.4 },
  '10k': { baseFadeAtFinish: 0.04, exponent: 1.35 },
  half: { baseFadeAtFinish: 0.08, exponent: 1.25 },
  marathon: { baseFadeAtFinish: 0.14, exponent: 1.2 },
}

const FATIGUE_SEVERITY: Record<'low' | 'moderate' | 'high', number> = {
  low: 0.8,
  moderate: 1.0,
  high: 1.3,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function fatigueMultiplierAt(
  distance: Distance,
  fatigueLevel: 'low' | 'moderate' | 'high',
  progress: number,
  calibrationFatiguePenalty: number
): number {
  const profile = CURVE_BY_DISTANCE[distance]
  const boundedProgress = clamp(progress, 0, 1)
  const fatigueFactor = FATIGUE_SEVERITY[fatigueLevel]
  const calibrationFactor = clamp(calibrationFatiguePenalty, 0, 1.5)

  const fade =
    profile.baseFadeAtFinish *
    fatigueFactor *
    calibrationFactor *
    boundedProgress ** profile.exponent

  // Safety clamp: no negative fade, max +35% pace slowdown from fatigue curve.
  return clamp(1 + fade, 1, 1.35)
}

export function computeFadeRisk(
  distance: Distance,
  fatigueLevel: 'low' | 'moderate' | 'high',
  trend: number,
  confidence: number,
  calibrationFatiguePenalty: number
): 'low' | 'moderate' | 'high' {
  const finishMultiplier = fatigueMultiplierAt(
    distance,
    fatigueLevel,
    1,
    calibrationFatiguePenalty
  )
  const confidencePenalty = (1 - clamp(confidence, 0, 1)) * 0.08
  const trendRelief = trend > 2 ? -0.02 : trend < -1 ? 0.03 : 0
  const compositeFade = finishMultiplier - 1 + confidencePenalty + trendRelief

  if (compositeFade < 0.07) return 'low'
  if (compositeFade < 0.15) return 'moderate'
  return 'high'
}
