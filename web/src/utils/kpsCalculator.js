/**
 * Canonical KPS (Kinetix Performance Score) calculation (0–100, 100 = lifetime best)
 *
 * Canonical math:
 * - eq5k_sec via Riegel: T₂ = T₁ × (D₂/D₁)^1.06
 * - pb_eq5k_sec = minimum eq5k_sec ever recorded (strictly faster only)
 * - score_raw = 100 * (pb_eq5k_sec / eq5k_sec)
 * - If eq5k_sec < pb_eq5k_sec: update PB to this run, set KPS = 100
 * - Else: KPS = min(100, score_raw)
 */

const RIEGEL_EXPONENT = 1.06;
const REF_DISTANCE_KM = 5.0;

export function computeEq5kSeconds(distanceKm, timeSeconds) {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(timeSeconds)) return null;
  if (distanceKm <= 0 || timeSeconds <= 0) return null;
  return timeSeconds * Math.pow(REF_DISTANCE_KM / distanceKm, RIEGEL_EXPONENT);
}

export function computeKpsWithPb(distanceKm, timeSeconds, pbEq5kSec) {
  const eq5kSec = computeEq5kSeconds(distanceKm, timeSeconds);
  const pb = Number.isFinite(pbEq5kSec) && pbEq5kSec > 0 ? pbEq5kSec : null;

  if (eq5kSec == null) {
    return { kps: 0, eq5kSec: null, pbEq5kSecNext: pb, setPb: false };
  }

  if (pb == null) {
    return { kps: 100, eq5kSec, pbEq5kSecNext: eq5kSec, setPb: true };
  }

  // Strictly faster only — ties do NOT replace PB.
  if (eq5kSec < pb) {
    return { kps: 100, eq5kSec, pbEq5kSecNext: eq5kSec, setPb: true };
  }

  const scoreRaw = 100 * (pb / eq5kSec);
  return { kps: Math.min(100, scoreRaw), eq5kSec, pbEq5kSecNext: pb, setPb: false };
}

export function calculateTimeToBeatKps(currentDistanceKm, currentTimeSeconds, currentPaceSecondsPerKm, targetKps, pbEq5kSec) {
  if (currentDistanceKm < 0.05) return { timeToBeat: null, progress: 0 };
  if (!Number.isFinite(pbEq5kSec) || pbEq5kSec <= 0) return { timeToBeat: null, progress: 0 };
  if (!Number.isFinite(targetKps) || targetKps <= 0) return { timeToBeat: 'INCREASE PACE', progress: 0.02 };
  if (!Number.isFinite(currentPaceSecondsPerKm) || currentPaceSecondsPerKm <= 0) return { timeToBeat: null, progress: 0 };

  const current = computeKpsWithPb(currentDistanceKm, currentTimeSeconds, pbEq5kSec);
  if (current.kps >= targetKps) return { timeToBeat: 'TARGET REACHED!', progress: 1.0 };

  const desiredEq5kSec = pbEq5kSec * (100 / targetKps);
  const numerator = currentPaceSecondsPerKm * Math.pow(REF_DISTANCE_KM, RIEGEL_EXPONENT);
  const ratio = numerator / desiredEq5kSec;
  if (!Number.isFinite(ratio) || ratio <= 0) return { timeToBeat: 'INCREASE PACE', progress: 0.02 };

  const distanceNeededKm = Math.pow(ratio, 1 / (RIEGEL_EXPONENT - 1));
  if (!Number.isFinite(distanceNeededKm) || distanceNeededKm <= currentDistanceKm) {
    return { timeToBeat: 'TARGET REACHED!', progress: 1.0 };
  }
  if (distanceNeededKm > 500) return { timeToBeat: 'INCREASE PACE', progress: 0.02 };

  const distRemaining = distanceNeededKm - currentDistanceKm;
  const timeSecs = distRemaining * currentPaceSecondsPerKm;
  const m = Math.floor(timeSecs / 60);
  const s = Math.floor(timeSecs % 60);
  const paceMin = Math.floor(currentPaceSecondsPerKm / 60);
  const paceSec = Math.floor(currentPaceSecondsPerKm % 60);

  const timeToBeat = `${m}:${s.toString().padStart(2, '0')} @ AVG ${paceMin}:${paceSec.toString().padStart(2, '0')}`;
  const totalExpectedTime = currentTimeSeconds + timeSecs;
  const progress = totalExpectedTime > 0 ? currentTimeSeconds / totalExpectedTime : 0;

  return { timeToBeat, progress: Math.min(progress, 1.0) };
}

export function calculateKpsFromRace(distance, timeString, unit = 'metric', pbEq5kSec) {
  const distanceKm = unit === 'metric' ? distance : distance * 1.60934;
  const parts = String(timeString).split(':').map(Number);
  let timeInSeconds;

  if (parts.length === 2) {
    timeInSeconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    timeInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else {
    throw new Error('Invalid time format');
  }

  const result = computeKpsWithPb(distanceKm, timeInSeconds, pbEq5kSec);
  return Math.min(100, result.kps);
}

