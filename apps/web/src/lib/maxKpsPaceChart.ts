import { formatPace, formatTime, timeToAchieveKPS } from '@kinetix/core'
import { type RunRecord } from './database'
import {
  calculateRelativeKPSSync,
  getPB,
  getPBRun,
  isValidKPS,
} from './kpsUtils'
import type { UserProfile } from '@kinetix/core'

/** Milestone distances in km for the KPS 100 curve. */
const KPS100_CURVE_DISTANCES_KM = [1, 3, 5, 10, 15, 21.0975, 42.195] as const

export interface Kps100CurvePoint {
  distanceKm: number
  distanceDisplay: number
  distanceUnitLabel: 'km' | 'mi'
  distanceLabel: string
  timeSeconds: number
  timeLabel: string
  paceSecondsPerKm: number
  paceSeconds: number
  paceLabel: string
}

/**
 * Builds chart points for the "Pace to hit KPS 100" curve: at each distance,
 * the target time and pace that would score exactly the given absolute KPS
 * (i.e. match the user's current PB). Uses Riegel formula via timeToAchieveKPS.
 */
export function generateKps100Curve(
  pbAbsoluteKps: number,
  userProfile: UserProfile,
  unitSystem: 'metric' | 'imperial'
): Kps100CurvePoint[] {
  if (!Number.isFinite(pbAbsoluteKps) || pbAbsoluteKps <= 0 || !userProfile) {
    return []
  }
  const points: Kps100CurvePoint[] = []
  for (const distanceKm of KPS100_CURVE_DISTANCES_KM) {
    const timeSeconds = timeToAchieveKPS(pbAbsoluteKps, distanceKm, userProfile)
    if (timeSeconds <= 0) continue
    const paceSecondsPerKm = timeSeconds / distanceKm
    const paceSeconds = toPaceSecondsForUnit(paceSecondsPerKm, unitSystem)
    const distanceDisplay =
      unitSystem === 'metric' ? distanceKm : distanceKm * KM_TO_MI
    const distanceUnitLabel = unitSystem === 'metric' ? 'km' : 'mi'
    const distanceLabel =
      distanceKm === 21.0975
        ? unitSystem === 'metric'
          ? 'Half marathon'
          : '13.1 mi'
        : distanceKm === 42.195
          ? unitSystem === 'metric'
            ? 'Marathon'
            : '26.2 mi'
          : `${distanceDisplay.toFixed(distanceDisplay >= 10 ? 0 : 1)} ${distanceUnitLabel}`
    points.push({
      distanceKm,
      distanceDisplay,
      distanceUnitLabel,
      distanceLabel,
      timeSeconds,
      timeLabel: formatTime(timeSeconds),
      paceSecondsPerKm,
      paceSeconds,
      paceLabel: `${formatPace(paceSecondsPerKm, unitSystem)} ${unitSystem === 'metric' ? '/km' : '/mi'}`,
    })
  }
  return points
}

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

// Reasonable pace: 2:00–15:00 min/km (120–900 s/km). Filters out bad data (e.g. pace stored as duration).
const PACE_SEC_PER_KM_MIN = 120
const PACE_SEC_PER_KM_MAX = 900

function isValidPerformanceRunRaw(run: RunRecord): boolean {
  return (
    Number.isFinite(run.duration) &&
    run.duration > 0 &&
    Number.isFinite(run.averagePace) &&
    run.averagePace >= PACE_SEC_PER_KM_MIN &&
    run.averagePace <= PACE_SEC_PER_KM_MAX &&
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

type GetProfileForRun = (run: RunRecord) => Promise<UserProfile>

function toChartPoint(
  run: RunRecord,
  kps: number,
  bucketStart: number,
  bucketSeconds: number,
  unitSystem: 'metric' | 'imperial'
): MaxKPSPaceDurationPoint {
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
    kps,
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
}

/**
 * Builds chart points where each duration bucket contributes only its max-KPS run.
 * KPS is ALWAYS age-weight graded (invariant 0) and RELATIVE to PB (invariant 2: PB = 100).
 * Pass getProfileForRun for production use.
 *
 * @param getProfileForRun - When provided, uses age-weight graded relative KPS. Required for display.
 * @param bucketSeconds - Optional. Default 300 (5 min).
 */
export async function buildMaxKPSPaceDurationPoints(
  runs: RunRecord[],
  unitSystem: 'metric' | 'imperial',
  getProfileForRun: GetProfileForRun,
  bucketSeconds = MAX_KPS_DURATION_BUCKET_SECONDS
): Promise<MaxKPSPaceDurationPoint[]> {
  if (!getProfileForRun) {
    throw new Error('buildMaxKPSPaceDurationPoints requires getProfileForRun (age-weight invariant).')
  }
  if (bucketSeconds <= 0 || runs.length === 0) return []

  return await buildMaxKPSPaceDurationPointsAsync(runs, unitSystem, bucketSeconds, getProfileForRun)
}

async function buildMaxKPSPaceDurationPointsAsync(
  runs: RunRecord[],
  unitSystem: 'metric' | 'imperial',
  bucketSeconds: number,
  getProfileForRun: GetProfileForRun
): Promise<MaxKPSPaceDurationPoint[]> {
  const pb = await getPB()
  const pbRun = await getPBRun()

  const bestByBucket = new Map<number, { run: RunRecord; relativeKPS: number }>()

  for (const run of runs) {
    if (!isValidPerformanceRunRaw(run)) continue

    let profile: UserProfile
    try {
      profile = await getProfileForRun(run)
    } catch {
      continue
    }
    const relativeKPS = calculateRelativeKPSSync(run, profile, pb, pbRun)
    if (!isValidKPS(relativeKPS)) continue

    const bucketStart = Math.floor(run.duration / bucketSeconds) * bucketSeconds
    const current = bestByBucket.get(bucketStart)

    const shouldReplace =
      !current ||
      relativeKPS > current.relativeKPS ||
      (relativeKPS === current.relativeKPS && run.averagePace < current.run.averagePace) ||
      (relativeKPS === current.relativeKPS &&
        run.averagePace === current.run.averagePace &&
        run.date > current.run.date)

    if (shouldReplace) {
      bestByBucket.set(bucketStart, { run, relativeKPS })
    }
  }

  const result = [...bestByBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, { run, relativeKPS }]) =>
      toChartPoint(run, relativeKPS, bucketStart, bucketSeconds, unitSystem)
    )
  return result
}
