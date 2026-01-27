import { computeKpsWithPb, KPS_REFERENCE_DISTANCE_KM, RIEGEL_EXPONENT } from './calculator'

export interface ProjectionResult {
  timeToBeat: string | null
  progress: number
  distanceRemaining: number
  timeRemaining: number
}

function formatTimeToBeat(seconds: number, paceSecondsPerKm: number): string {
  const s = Math.max(0, seconds)
  const mPart = Math.floor(s / 60)
  const sPart = Math.floor(s % 60)

  const paceMin = Math.floor(paceSecondsPerKm / 60)
  const paceSec = Math.floor(paceSecondsPerKm % 60)

  return `${mPart}:${sPart.toString().padStart(2, '0')} @ AVG ${paceMin}:${paceSec.toString().padStart(2, '0')}`
}

/**
 * KPS projection: estimate time/distance remaining to reach a target KPS
 * while holding the current average pace.
 */
export function calculateTimeToBeatKps(params: {
  currentDistanceKm: number
  currentTimeSeconds: number
  currentPaceSecondsPerKm: number
  targetKps: number
  pbEq5kSec: number | null | undefined
}): ProjectionResult {
  const {
    currentDistanceKm,
    currentTimeSeconds,
    currentPaceSecondsPerKm,
    targetKps,
    pbEq5kSec,
  } = params

  if (currentDistanceKm < 0.05) {
    // During initial calibration (first 50m), no projection
    return { timeToBeat: null, progress: 0, distanceRemaining: 0, timeRemaining: 0 }
  }

  if (!pbEq5kSec || !Number.isFinite(pbEq5kSec) || pbEq5kSec <= 0) {
    return { timeToBeat: null, progress: 0, distanceRemaining: 0, timeRemaining: 0 }
  }

  if (!Number.isFinite(targetKps) || targetKps <= 0) {
    return { timeToBeat: 'INCREASE PACE', progress: 0.02, distanceRemaining: Infinity, timeRemaining: Infinity }
  }

  const current = computeKpsWithPb({
    distanceKm: currentDistanceKm,
    timeSeconds: currentTimeSeconds,
    pbEq5kSec,
  })

  // If target already reached (or exceeded), stop.
  if (current.kps >= targetKps) {
    return { timeToBeat: 'TARGET REACHED!', progress: 1.0, distanceRemaining: 0, timeRemaining: 0 }
  }

  if (!Number.isFinite(currentPaceSecondsPerKm) || currentPaceSecondsPerKm <= 0) {
    return { timeToBeat: null, progress: 0, distanceRemaining: 0, timeRemaining: 0 }
  }

  // Need eq5k_sec such that: targetKps = 100 * (pb / eq5k)  => eq5k = pb * (100/target)
  const desiredEq5kSec = pbEq5kSec * (100 / targetKps)

  // eq5k_sec = pace * d * (5/d)^1.06 = pace * 5^1.06 * d^-0.06
  // Solve for d: d = (pace * 5^1.06 / eq5k)^ (1/0.06)
  const numerator = currentPaceSecondsPerKm * Math.pow(KPS_REFERENCE_DISTANCE_KM, RIEGEL_EXPONENT)
  const ratio = numerator / desiredEq5kSec

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { timeToBeat: 'INCREASE PACE', progress: 0.02, distanceRemaining: Infinity, timeRemaining: Infinity }
  }

  const distanceNeededKm = Math.pow(ratio, 1 / (RIEGEL_EXPONENT - 1)) // 1/0.06

  if (!Number.isFinite(distanceNeededKm) || distanceNeededKm <= currentDistanceKm) {
    return { timeToBeat: 'TARGET REACHED!', progress: 1.0, distanceRemaining: 0, timeRemaining: 0 }
  }

  // If the target would require a crazy distance, treat as "increase pace"
  if (distanceNeededKm > 500) {
    return { timeToBeat: 'INCREASE PACE', progress: 0.02, distanceRemaining: Infinity, timeRemaining: Infinity }
  }

  const distanceRemaining = distanceNeededKm - currentDistanceKm
  const timeRemaining = distanceRemaining * currentPaceSecondsPerKm
  const totalExpectedTime = currentTimeSeconds + timeRemaining
  const progress = totalExpectedTime > 0 ? currentTimeSeconds / totalExpectedTime : 0

  return {
    timeToBeat: formatTimeToBeat(timeRemaining, currentPaceSecondsPerKm),
    progress: Math.min(Math.max(progress, 0), 1),
    distanceRemaining,
    timeRemaining,
  }
}

