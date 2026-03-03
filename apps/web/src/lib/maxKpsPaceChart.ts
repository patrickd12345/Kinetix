import { formatPace, formatTime } from '@kinetix/core'
import { type RunRecord } from './database'

const SEC_PER_KM_TO_SEC_PER_MI = 1.60934
const M_TO_KM = 1000
const KM_TO_MI = 0.621371

export const MAX_KPS_DURATION_BUCKET_SECONDS = 5 * 60

export interface MaxKPSPaceDurationPoint {
  runId?: number
  bucketStartSeconds: number
  bucketEndSeconds: number
  bucketLabel: string
  durationSeconds: number
  durationMinutes: number
  durationLabel: string
  paceSeconds: number
  paceLabel: string
  kps: number
  date: string
  dateFormatted: string
  distanceMeters: number
  distanceDisplay: number
  distanceUnitLabel: 'km' | 'mi'
}

function isValidPerformanceRun(run: RunRecord): boolean {
  return (
    Number.isFinite(run.kps) &&
    run.kps > 0 &&
    Number.isFinite(run.duration) &&
    run.duration > 0 &&
    Number.isFinite(run.averagePace) &&
    run.averagePace > 0 &&
    Number.isFinite(run.distance) &&
    run.distance > 0
  )
}

export function toPaceSecondsForUnit(
  paceSecondsPerKm: number,
  unitSystem: 'metric' | 'imperial'
): number {
  return unitSystem === 'metric'
    ? paceSecondsPerKm
    : paceSecondsPerKm * SEC_PER_KM_TO_SEC_PER_MI
}

function formatAxisPaceLabel(
  paceSecondsPerKm: number,
  unitSystem: 'metric' | 'imperial'
): string {
  const suffix = unitSystem === 'metric' ? '/km' : '/mi'
  return `${formatPace(paceSecondsPerKm, unitSystem)} ${suffix}`
}

function toDistanceDisplay(
  distanceMeters: number,
  unitSystem: 'metric' | 'imperial'
): { value: number; unit: 'km' | 'mi' } {
  if (unitSystem === 'metric') {
    return { value: distanceMeters / M_TO_KM, unit: 'km' }
  }
  return { value: (distanceMeters / M_TO_KM) * KM_TO_MI, unit: 'mi' }
}

/**
 * Builds chart points where each duration bucket contributes only its max-KPS run.
 */
export function buildMaxKPSPaceDurationPoints(
  runs: RunRecord[],
  unitSystem: 'metric' | 'imperial',
  bucketSeconds = MAX_KPS_DURATION_BUCKET_SECONDS
): MaxKPSPaceDurationPoint[] {
  if (bucketSeconds <= 0 || runs.length === 0) return []

  const bestByBucket = new Map<number, RunRecord>()

  for (const run of runs) {
    if (!isValidPerformanceRun(run)) continue

    const bucketStart = Math.floor(run.duration / bucketSeconds) * bucketSeconds
    const currentBest = bestByBucket.get(bucketStart)

    if (!currentBest) {
      bestByBucket.set(bucketStart, run)
      continue
    }

    // Keep the strongest run for each duration bucket.
    // Tie-breakers prefer faster pace then newer date.
    const shouldReplace =
      run.kps > currentBest.kps ||
      (run.kps === currentBest.kps && run.averagePace < currentBest.averagePace) ||
      (run.kps === currentBest.kps &&
        run.averagePace === currentBest.averagePace &&
        run.date > currentBest.date)

    if (shouldReplace) {
      bestByBucket.set(bucketStart, run)
    }
  }

  return [...bestByBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, run]) => {
      const date = new Date(run.date)
      const distance = toDistanceDisplay(run.distance, unitSystem)
      return {
        runId: run.id,
        bucketStartSeconds: bucketStart,
        bucketEndSeconds: bucketStart + bucketSeconds,
        bucketLabel: `${formatTime(bucketStart)} - ${formatTime(bucketStart + bucketSeconds)}`,
        durationSeconds: run.duration,
        durationMinutes: run.duration / 60,
        durationLabel: formatTime(run.duration),
        paceSeconds: toPaceSecondsForUnit(run.averagePace, unitSystem),
        paceLabel: formatAxisPaceLabel(run.averagePace, unitSystem),
        kps: run.kps,
        date: run.date,
        dateFormatted: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        distanceMeters: run.distance,
        distanceDisplay: distance.value,
        distanceUnitLabel: distance.unit,
      }
    })
}
