import type { DistanceCalibration } from '../calibration/types'
import type { PredictionDirection } from '../trainingPlan/types'
import type { FatigueResult } from '../intelligence/types'
import type { TrainingPhase } from './types'

interface ProgressionProfile {
  volumeDeltaPct: number
  intensityDeltaPct: number
  focus: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const PHASE_BASELINE: Record<TrainingPhase, { volume: number; intensity: number; focus: string }> = {
  base: {
    volume: 0.06,
    intensity: 0.02,
    focus: 'Aerobic base and consistency',
  },
  build: {
    volume: 0.04,
    intensity: 0.05,
    focus: 'Specific strength and threshold development',
  },
  peak: {
    volume: 0.01,
    intensity: 0.06,
    focus: 'Race-specific sharpening and quality control',
  },
  taper: {
    volume: -0.08,
    intensity: -0.03,
    focus: 'Freshness, recovery, and race readiness',
  },
}

export function computeWeeklyProgression(input: {
  phase: TrainingPhase
  predictionDirection: PredictionDirection
  fatigue: FatigueResult
  calibration: DistanceCalibration
}): ProgressionProfile {
  const baseline = PHASE_BASELINE[input.phase]
  const fatigueModifier =
    input.fatigue.level === 'high' ? -0.06 : input.fatigue.level === 'moderate' ? -0.025 : 0
  const predictionModifier =
    input.predictionDirection === 'improving'
      ? 0.02
      : input.predictionDirection === 'declining'
        ? -0.03
        : 0

  const volumeDeltaPct = clamp(
    baseline.volume + fatigueModifier + predictionModifier * input.calibration.enduranceWeight,
    -0.15,
    0.12
  )
  const intensityDeltaPct = clamp(
    baseline.intensity + fatigueModifier * 0.7 + predictionModifier * input.calibration.speedWeight,
    -0.12,
    0.1
  )

  return {
    volumeDeltaPct,
    intensityDeltaPct,
    focus: `${baseline.focus} (volume ${Math.round(volumeDeltaPct * 100)}%, intensity ${Math.round(
      intensityDeltaPct * 100
    )}%).`,
  }
}
