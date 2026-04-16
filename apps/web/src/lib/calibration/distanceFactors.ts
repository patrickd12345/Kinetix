import type { DistanceCalibration, Distance } from './types'

/**
 * Global clamp bounds are explicit to avoid hidden ranges.
 * - speed/endurance/trend weights remain in [0, 2]
 * - fatigue penalty remains in [0, 1]
 */
const CALIBRATION_LIMITS = {
  weightMin: 0,
  weightMax: 2,
  fatiguePenaltyMin: 0,
  fatiguePenaltyMax: 1,
} as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampCalibration(calibration: DistanceCalibration): DistanceCalibration {
  return {
    speedWeight: clamp(
      calibration.speedWeight,
      CALIBRATION_LIMITS.weightMin,
      CALIBRATION_LIMITS.weightMax
    ),
    enduranceWeight: clamp(
      calibration.enduranceWeight,
      CALIBRATION_LIMITS.weightMin,
      CALIBRATION_LIMITS.weightMax
    ),
    fatiguePenalty: clamp(
      calibration.fatiguePenalty,
      CALIBRATION_LIMITS.fatiguePenaltyMin,
      CALIBRATION_LIMITS.fatiguePenaltyMax
    ),
    trendSensitivity: clamp(
      calibration.trendSensitivity,
      CALIBRATION_LIMITS.weightMin,
      CALIBRATION_LIMITS.weightMax
    ),
  }
}

/**
 * Deterministic distance calibration table.
 * Assumptions:
 * - 5k favors speed responsiveness and lower fatigue drag.
 * - 10k remains speed-oriented with moderate endurance demand.
 * - Half stays balanced between speed/endurance.
 * - Marathon emphasizes endurance with higher fatigue penalties.
 */
const RAW_DISTANCE_FACTORS: Record<Distance, DistanceCalibration> = {
  '5k': {
    speedWeight: 1.25,
    enduranceWeight: 0.75,
    fatiguePenalty: 0.35,
    trendSensitivity: 1.15,
  },
  '10k': {
    speedWeight: 1.1,
    enduranceWeight: 0.9,
    fatiguePenalty: 0.45,
    trendSensitivity: 1.0,
  },
  half: {
    speedWeight: 1.0,
    enduranceWeight: 1.05,
    fatiguePenalty: 0.55,
    trendSensitivity: 0.95,
  },
  marathon: {
    speedWeight: 0.8,
    enduranceWeight: 1.25,
    fatiguePenalty: 0.75,
    trendSensitivity: 0.85,
  },
}

export const DISTANCE_FACTORS: Record<Distance, DistanceCalibration> = {
  '5k': clampCalibration(RAW_DISTANCE_FACTORS['5k']),
  '10k': clampCalibration(RAW_DISTANCE_FACTORS['10k']),
  half: clampCalibration(RAW_DISTANCE_FACTORS.half),
  marathon: clampCalibration(RAW_DISTANCE_FACTORS.marathon),
}
