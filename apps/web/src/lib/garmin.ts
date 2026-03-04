/**
 * Garmin export ingestion: types, normalization, and parsing.
 * Only processes DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json
 * and keeps activities where activityType.typeKey === "running".
 */

import { calculateKPS } from '@kinetix/core'
import type { UserProfile } from '@kinetix/core'
import type { RunRecord } from './database'
import { isMeaningfulRunForKPS } from './kpsUtils'

export const GARMIN_SOURCE = 'garmin' as const

/** Normalized run shape for persistence (matches RunRecord minus id) */
export interface GarminNormalizedRun {
  external_id: string
  date: string
  distance: number
  duration: number
  averagePace: number
  targetKPS: number
  locations: Array<{ lat: number; lon: number; timestamp: number }>
  splits: Array<{ distance: number; time: number; pace: number }>
  heartRate?: number
  notes?: string
  source: string
}

/** Expected shape of one activity in Garmin summarizedActivities JSON (defensive) */
export interface GarminActivityRaw {
  activityId?: number
  activityName?: string
  name?: string
  /** Garmin export: either object with typeKey or plain string e.g. "running" */
  activityType?: { typeKey?: string; [k: string]: unknown } | string
  startTimeGMT?: string
  startTimeLocal?: string | number
  startTimeGmt?: number
  beginTimestamp?: number
  duration?: number
  elapsedDuration?: number
  movingDuration?: number
  distance?: number
  averageHR?: number
  maxHR?: number
  avgHr?: number
  maxHr?: number
  calories?: number
  elevationGain?: number
  averagePace?: number
  device?: { deviceName?: string; [k: string]: unknown }
  deviceId?: number
  [key: string]: unknown
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) return value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    if (!isNaN(n) && isFinite(n)) return n
  }
  return undefined
}

function getString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

/**
 * Normalize one Garmin activity to our run shape. Returns null if not running or invalid.
 */
export function normalizeGarminActivity(
  raw: GarminActivityRaw,
  targetKPS: number
): GarminNormalizedRun | null {
  const activityTypeVal = raw.activityType
  const typeStr =
    typeof activityTypeVal === 'string'
      ? activityTypeVal
      : getString((activityTypeVal as { typeKey?: string })?.typeKey) ?? ''
  const isRunning =
    typeStr === 'running' ||
    typeStr.toLowerCase() === 'run' ||
    (typeStr.length > 0 && typeStr.toLowerCase().includes('run'))
  if (!isRunning) return null

  const activityId = raw.activityId ?? getNumber(raw.activityId)
  const external_id = activityId != null ? String(activityId) : undefined
  if (!external_id) return null

  const durationMs =
    getNumber(raw.duration) ??
    getNumber(raw.elapsedDuration) ??
    getNumber(raw.movingDuration)
  const distanceRaw = getNumber(raw.distance)
  if (durationMs == null || durationMs <= 0 || distanceRaw == null || distanceRaw <= 0)
    return null

  const durationSeconds = durationMs >= 1000 ? durationMs / 1000 : durationMs
  const distanceMeters =
    distanceRaw > 100000 ? distanceRaw / 100 : distanceRaw > 1000 ? distanceRaw : distanceRaw * 1000
  const averagePace = distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000) : 0
  if (!isFinite(averagePace) || averagePace <= 0) return null

  const startMs =
    getNumber(raw.startTimeGmt) ??
    getNumber(raw.beginTimestamp) ??
    (typeof raw.startTimeLocal === 'number' ? raw.startTimeLocal : null)
  const startTimeGMT = getString(raw.startTimeGMT)
  const date = startTimeGMT
    ? new Date(startTimeGMT).toISOString()
    : startMs != null
      ? new Date(startMs).toISOString()
      : new Date(getString(raw.startTimeLocal) ?? 0).toISOString()

  const avgHR =
    getNumber(raw.avgHr) ??
    getNumber(raw.maxHr) ??
    getNumber(raw.averageHR) ??
    getNumber(raw.maxHR)
  const deviceName = getString((raw.device as { deviceName?: string })?.deviceName)
  const notes = getString(raw.name) ?? getString(raw.activityName)
  const notesStr = notes ? `${notes}${deviceName ? ` (${deviceName})` : ''}` : `Garmin ${external_id}`

  return {
    external_id,
    date,
    distance: distanceMeters,
    duration: durationSeconds,
    averagePace,
    targetKPS,
    locations: [],
    splits: [],
    heartRate: avgHR ?? undefined,
    notes: notesStr,
    source: GARMIN_SOURCE,
  }
}

/**
 * Convert a normalized Garmin run to RunRecord using profile for KPS.
 */
export function convertGarminToRunRecord(
  normalized: GarminNormalizedRun,
  userProfile: UserProfile,
  targetKPS: number
): RunRecord | null {
  if (!isMeaningfulRunForKPS({ distance: normalized.distance, duration: normalized.duration })) {
    return null
  }
  const kps = calculateKPS(
    { distanceKm: normalized.distance / 1000, timeSeconds: normalized.duration },
    userProfile
  )
  if (kps <= 0 || !isFinite(kps)) return null
  return {
    external_id: normalized.external_id,
    date: normalized.date,
    distance: normalized.distance,
    duration: normalized.duration,
    averagePace: normalized.averagePace,
    targetKPS,
    locations: normalized.locations,
    splits: normalized.splits,
    heartRate: normalized.heartRate,
    notes: normalized.notes,
    source: GARMIN_SOURCE,
    weightKg: userProfile.weightKg,
  }
}

export interface ParseSummarizedActivitiesResult {
  runs: GarminNormalizedRun[]
  totalActivities: number
}

function toActivityArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    const out: unknown[] = []
    for (const item of data) {
      const inner = (item != null && typeof item === 'object' && (item as { summarizedActivitiesExport?: unknown[] }).summarizedActivitiesExport) as unknown[] | undefined
      if (Array.isArray(inner)) {
        out.push(...inner)
      } else if (item != null && typeof item === 'object' && 'activityId' in item) {
        out.push(item)
      } else if (item != null && typeof item === 'object') {
        out.push(item)
      }
    }
    return out
  }
  if (data != null && typeof data === 'object') {
    const arr = (data as { summarizedActivitiesExport?: unknown[] }).summarizedActivitiesExport
    if (Array.isArray(arr)) return toActivityArray(arr)
    const alt = (data as { activities?: unknown[] }).activities
    if (Array.isArray(alt)) return alt
  }
  return []
}

/**
 * Parse a single summarizedActivities JSON file content. Returns normalized running activities and total count.
 * Accepts top-level array or wrapper e.g. { summarizedActivitiesExport: [...] }.
 */
export function parseSummarizedActivitiesJson(
  json: string,
  targetKPS: number
): ParseSummarizedActivitiesResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  const arr = toActivityArray(data)
  if (arr.length === 0 && !Array.isArray(data)) {
    throw new Error('Expected summarizedActivities JSON to be an array or { summarizedActivitiesExport: [...] }')
  }
  const runs: GarminNormalizedRun[] = []
  for (const item of arr) {
    if (item != null && typeof item === 'object') {
      const run = normalizeGarminActivity(item as GarminActivityRaw, targetKPS)
      if (run) runs.push(run)
    }
  }
  return { runs, totalActivities: arr.length }
}
