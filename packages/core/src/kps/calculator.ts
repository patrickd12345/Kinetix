// Canonical KPS (Kinetix Performance Score)
// Range: 0–100 inclusive
// 100 ALWAYS represents the user's current lifetime PB reference (pb_eq5k_sec)
//
// Canonical math:
// - eq5k_sec computed via Riegel formula (T₂ = T₁ × (D₂/D₁)^1.06)
// - pb_eq5k_sec = minimum eq5k_sec ever recorded (strictly faster only)
// - score_raw = 100 * (pb_eq5k_sec / eq5k_sec)
// - If eq5k_sec < pb_eq5k_sec: update PB to this run, set KPS = 100
// - Else: KPS = min(100, score_raw)

export const RIEGEL_EXPONENT = 1.06
export const KPS_REFERENCE_DISTANCE_KM = 5.0

export interface KpsComputationResult {
  kps: number // 0–100
  eq5kSec: number | null
  pbEq5kSecNext: number | null
  setPb: boolean
}

export function computeEq5kSeconds(distanceKm: number, timeSeconds: number): number | null {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(timeSeconds)) return null
  if (distanceKm <= 0 || timeSeconds <= 0) return null
  return timeSeconds * Math.pow(KPS_REFERENCE_DISTANCE_KM / distanceKm, RIEGEL_EXPONENT)
}

export function computeKpsWithPb(params: {
  distanceKm: number
  timeSeconds: number
  pbEq5kSec: number | null | undefined
}): KpsComputationResult {
  const eq5kSec = computeEq5kSeconds(params.distanceKm, params.timeSeconds)
  const pbEq5kSec = params.pbEq5kSec ?? null

  if (eq5kSec == null) {
    return { kps: 0, eq5kSec: null, pbEq5kSecNext: pbEq5kSec, setPb: false }
  }

  // First valid run initializes PB reference.
  if (pbEq5kSec == null || !Number.isFinite(pbEq5kSec) || pbEq5kSec <= 0) {
    return { kps: 100, eq5kSec, pbEq5kSecNext: eq5kSec, setPb: true }
  }

  // Strictly faster only — ties do NOT replace PB.
  if (eq5kSec < pbEq5kSec) {
    return { kps: 100, eq5kSec, pbEq5kSecNext: eq5kSec, setPb: true }
  }

  const scoreRaw = 100 * (pbEq5kSec / eq5kSec)
  const kps = Math.min(100, scoreRaw)
  return { kps, eq5kSec, pbEq5kSecNext: pbEq5kSec, setPb: false }
}

