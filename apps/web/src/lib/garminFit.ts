/**
 * Parse Garmin / device .FIT files into GarminNormalizedRun (single-activity uploads).
 */

import FitParser from 'fit-file-parser'
import type { GarminNormalizedRun } from './garmin'
import { GARMIN_SOURCE } from './garmin'

type SessionLike = {
  sport?: string
  sub_sport?: string
  start_time?: string
  total_timer_time?: number
  total_elapsed_time?: number
  total_distance?: number
  avg_heart_rate?: number
  max_heart_rate?: number
}

type FitDataLike = {
  sessions?: SessionLike[]
  activity?: { sessions?: SessionLike[] }
}

function isRunningSession(s: SessionLike): boolean {
  const sp = (s.sport ?? '').toLowerCase()
  if (sp === 'running') return true
  return false
}

function externalIdFromHint(filenameHint: string | undefined, sessionIndex: number, startTime: string): string {
  const base = filenameHint?.replace(/\\/g, '/').split('/').pop() ?? ''
  const digits = base.match(/^(\d+)/)
  if (digits) return `fit-${digits[1]}`
  let h = 0
  for (let i = 0; i < startTime.length; i++) h = (Math.imul(31, h) + startTime.charCodeAt(i)) | 0
  return `fit-${sessionIndex}-${Math.abs(h).toString(16)}`
}

function sessionToNormalized(
  s: SessionLike,
  targetKPS: number,
  external_id: string
): GarminNormalizedRun | null {
  if (!s.start_time) return null
  if (!isRunningSession(s)) return null
  const durationSeconds =
    typeof s.total_timer_time === 'number' && s.total_timer_time > 0
      ? s.total_timer_time
      : typeof s.total_elapsed_time === 'number' && s.total_elapsed_time > 0
        ? s.total_elapsed_time
        : 0
  const distanceMeters = typeof s.total_distance === 'number' ? s.total_distance : 0
  if (durationSeconds <= 0 || distanceMeters <= 0) return null

  const averagePace = distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000) : 0
  if (!isFinite(averagePace) || averagePace <= 0) return null

  let date: string
  try {
    date = new Date(s.start_time).toISOString()
  } catch {
    date = new Date().toISOString()
  }

  const hr = s.avg_heart_rate ?? s.max_heart_rate

  return {
    external_id,
    date,
    distance: distanceMeters,
    duration: durationSeconds,
    averagePace,
    targetKPS,
    locations: [],
    splits: [],
    heartRate: typeof hr === 'number' && hr > 0 ? hr : undefined,
    notes: `Garmin FIT (${s.sub_sport ?? s.sport ?? 'run'})`,
    source: GARMIN_SOURCE,
  }
}

/**
 * Parse a .FIT file (ArrayBuffer) into zero or more running sessions.
 */
export async function parseFitArrayBufferToNormalizedRuns(
  arrayBuffer: ArrayBuffer,
  targetKPS: number,
  options?: { filenameHint?: string }
): Promise<GarminNormalizedRun[]> {
  const fitParser = new FitParser({
    force: true,
    lengthUnit: 'm',
    mode: 'list',
  })
  const data = (await fitParser.parseAsync(arrayBuffer)) as FitDataLike
  const sessions = data.sessions ?? data.activity?.sessions ?? []
  const out: GarminNormalizedRun[] = []
  let idx = 0
  for (const s of sessions) {
    const st = s.start_time ?? ''
    const ext = externalIdFromHint(options?.filenameHint, idx, st || `idx-${idx}`)
    const run = sessionToNormalized(s, targetKPS, ext)
    if (run) out.push(run)
    idx += 1
  }
  return out
}
