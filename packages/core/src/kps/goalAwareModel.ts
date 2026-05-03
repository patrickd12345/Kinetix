export type RunGoalMode = 'free_run' | 'half_marathon' | 'marathon_6h' | 'beat_recent_distance_at_recent_pace'

export const HALF_MARATHON_KM = 21.0975
export const MARATHON_KM = 42.195
export const SIX_HOUR_MARATHON_SEC = 21600
export const SIX_HOUR_MARATHON_PACE_SEC_PER_KM = 511.91 // 21600 / 42.195

export interface RunGoalTarget {
  targetDistanceKm?: number
  targetTimeSec?: number
}

export interface RunGoalProgress {
  remainingDistanceKm?: number
  remainingTimeSec?: number
  requiredRemainingPaceSecPerKm?: number
  targetBufferSec?: number
}

export function computeGoalProgress(
  mode: RunGoalMode,
  currentDistanceKm: number,
  elapsedSec: number,
  customTarget?: RunGoalTarget
): RunGoalProgress {
  if (mode === 'free_run') return {}

  let targetDistanceKm: number | undefined
  let targetTimeSec: number | undefined

  if (mode === 'half_marathon') {
    targetDistanceKm = HALF_MARATHON_KM
  } else if (mode === 'marathon_6h') {
    targetDistanceKm = MARATHON_KM
    targetTimeSec = SIX_HOUR_MARATHON_SEC
  } else if (mode === 'beat_recent_distance_at_recent_pace') {
    targetDistanceKm = customTarget?.targetDistanceKm
    targetTimeSec = customTarget?.targetTimeSec
  }

  if (targetDistanceKm === undefined) return {}

  const remainingDistanceKm = Math.max(0, targetDistanceKm - currentDistanceKm)
  let remainingTimeSec: number | undefined
  let requiredRemainingPaceSecPerKm: number | undefined
  let targetBufferSec: number | undefined

  if (targetTimeSec !== undefined) {
    remainingTimeSec = Math.max(0, targetTimeSec - elapsedSec)

    if (remainingDistanceKm > 0) {
      requiredRemainingPaceSecPerKm = remainingTimeSec / remainingDistanceKm
    } else {
      requiredRemainingPaceSecPerKm = 0
    }

    const projectedTotalTime = (currentDistanceKm > 0)
      ? (elapsedSec / currentDistanceKm) * targetDistanceKm
      : targetTimeSec

    targetBufferSec = targetTimeSec - projectedTotalTime
  }

  return {
    remainingDistanceKm,
    remainingTimeSec,
    requiredRemainingPaceSecPerKm,
    targetBufferSec,
  }
}
