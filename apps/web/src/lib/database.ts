import Dexie, { Table } from 'dexie'
import { UserProfile } from '@kinetix/core'

/** 0 = visible, 1 = logically deleted (hidden from UI and stats) */
export const RUN_DELETED = 1
export const RUN_VISIBLE = 0

export interface RunRecord {
  id?: number
  /** External source id (e.g. Garmin activityId) for idempotent import */
  external_id?: string
  date: string
  distance: number // meters
  duration: number // seconds
  averagePace: number // seconds per km
  /** Legacy cached absolute KPS (deprecated). KPS is now derived dynamically and this field is not authoritative. */
  kps?: number
  targetKPS: number
  locations: Array<{ lat: number; lon: number; timestamp: number }>
  splits: Array<{ distance: number; time: number; pace: number }>
  heartRate?: number
  notes?: string
  tags?: string[]
  source?: string
  /** 0 = visible, 1 = hidden (logical delete). Omit/undefined treated as 0. */
  deleted?: 0 | 1
  /** Weight (kg) used for KPS when this run was saved. Avoids querying weight history on every display. */
  weightKg?: number
  /** Optional music linked to the run (for coach / BPM vs cadence analysis). */
  songTitle?: string
  songArtist?: string
  /** Track tempo (beats per minute); compare to cadence (steps/min) for rhythm alignment. */
  songBpm?: number
}

/**
 * Personal Best (PB) Record
 * 
 * INVARIANT: PB is a FACT, not a calculation.
 * - PB stores the runId that achieved the PB
 * - PB stores the profile snapshot used when it was set
 * - PB only changes when a strictly better run occurs
 * - PB run ALWAYS displays KPS = 100 by definition
 */
export interface PBRecord {
  id?: number
  runId: number // Reference to the run that is the PB
  achievedAt: string // ISO timestamp when PB was achieved
  profileSnapshot: UserProfile // Profile (age, weight) used when PB was set
}

/** One weight measurement (e.g. from Withings). dateUnix is unique per measurement. */
export interface WeightEntry {
  dateUnix: number
  date: string // ISO
  kg: number
}

class KinetixDatabase extends Dexie {
  runs!: Table<RunRecord>
  pb!: Table<PBRecord>
  weightHistory!: Table<WeightEntry>

  constructor() {
    super('KinetixDB')
    this.version(2).stores({
      runs: '++id, date, npi, distance, source',
      pb: '++id, runId, achievedAt',
    })
    this.version(3).stores({
      runs: '++id, date, npi, distance, source, external_id',
      pb: '++id, runId, achievedAt',
    })
    this.version(4).stores({
      runs: '++id, date, kps, distance, source, external_id',
      pb: '++id, runId, achievedAt',
    }).upgrade((tx) => {
      return tx.table('runs').toCollection().modify((run: Record<string, unknown>) => {
        const npi = run.npi as number | undefined
        const targetNPI = run.targetNPI as number | undefined
        if (npi !== undefined) { run.kps = npi; delete run.npi }
        if (targetNPI !== undefined) { run.targetKPS = targetNPI; delete run.targetNPI }
      })
    })
    this.version(5).stores({
      runs: '++id, date, kps, distance, source, external_id, deleted',
      pb: '++id, runId, achievedAt',
    }).upgrade((tx) => {
      return tx.table('runs').toCollection().modify((run: Record<string, unknown> & { date?: string; deleted?: 0 | 1 }) => {
        if (run.deleted === undefined) run.deleted = 0
        const d = run.date ?? ''
        if (d.startsWith('2025-10-18') || d.startsWith('2026-10-18')) run.deleted = 1
      })
    })
    this.version(6).stores({
      runs: '++id, date, kps, distance, source, external_id, deleted',
      pb: '++id, runId, achievedAt',
      weightHistory: 'dateUnix, date',
    })
    this.version(7).stores({
      runs: '++id, date, distance, source, external_id, deleted',
      pb: '++id, runId, achievedAt',
      weightHistory: 'dateUnix, date',
    }).upgrade((tx) => {
      return tx.table('runs').toCollection().modify((run: Record<string, unknown>) => {
        if ('kps' in run) delete run.kps
      })
    })
  }
}

export const db = new KinetixDatabase()

const RUNS_ORDERED = () =>
  db.runs
    .orderBy('date')
    .reverse()
    .filter((r) => (r.deleted ?? 0) === RUN_VISIBLE)
const RUNS_VISIBLE_COUNT = () => RUNS_ORDERED().count()

/**
 * Fetch one page of runs (newest first) and total count. Use for History pagination.
 * Excludes logically deleted runs.
 */
export async function getRunsPage(
  page: number,
  pageSize: number
): Promise<{ items: RunRecord[]; total: number }> {
  const total = await RUNS_VISIBLE_COUNT()
  const offset = Math.max(0, (page - 1) * pageSize)
  const items = await RUNS_ORDERED().offset(offset).limit(pageSize).toArray()
  return { items, total }
}

/**
 * All visible runs, newest first (same order as History list). Used when client-side filters are active.
 */
export async function getAllVisibleRunsOrdered(): Promise<RunRecord[]> {
  return RUNS_ORDERED().toArray()
}

/**
 * Return 1-based page number that contains the run at or just after the given date (in date-desc order).
 * Used for date-jump: go to the page that would contain that run. Excludes deleted runs.
 */
export async function getRunsPageForDate(
  selectedDateStr: string,
  pageSize: number
): Promise<number> {
  const total = await RUNS_VISIBLE_COUNT()
  if (total === 0) return 1
  const totalPages = Math.ceil(total / pageSize)
  const runsWithNewerDate = await RUNS_ORDERED().filter((r) => r.date > selectedDateStr).count()
  const index = runsWithNewerDate
  const page = Math.min(totalPages, Math.max(1, Math.floor(index / pageSize) + 1))
  return page
}

/**
 * Fetch runs in a date range (inclusive), ascending by date, for chart or range views.
 * Capped at limit. Excludes logically deleted runs.
 */
export async function getRunsInDateRange(
  startDate: string,
  endDate: string,
  limit: number
): Promise<RunRecord[]> {
  if (startDate > endDate) return []
  const raw = await db.runs
    .where('date')
    .between(startDate, endDate, true, true)
    .limit(limit * 3)
    .toArray()
  return raw.filter((r) => (r.deleted ?? 0) === RUN_VISIBLE).slice(0, limit)
}

/**
 * Logically delete (hide) a run. It will no longer appear in list, chart, or stats.
 * If this run is the current PB, the PB is cleared so a new one can be chosen.
 */
export async function hideRun(runId: number): Promise<void> {
  const run = await db.runs.get(runId)
  if (!run) return
  await db.runs.update(runId, { deleted: RUN_DELETED })
  const pbRecords = await db.pb.toArray()
  const isPB = pbRecords.some((p) => p.runId === runId)
  if (isPB) {
    await db.pb.clear()
  }
}

/**
 * Import weight entries (e.g. from Withings history JSON). Uses put so duplicates by dateUnix are overwritten.
 * Returns count of entries written and the latest kg (newest entry).
 */
export async function bulkPutWeightEntries(entries: WeightEntry[]): Promise<{ count: number; latestKg: number | null }> {
  if (entries.length === 0) return { count: 0, latestKg: null }
  await db.weightHistory.bulkPut(entries)
  const sorted = [...entries].sort((a, b) => b.dateUnix - a.dateUnix)
  const latest = sorted[0]
  return { count: entries.length, latestKg: latest?.kg ?? null }
}

/**
 * Get weight history count (for display).
 */
export async function getWeightHistoryCount(): Promise<number> {
  return db.weightHistory.count()
}

/** Newest stored measurement instant (Unix seconds), for Withings `lastupdate` incremental sync. */
export async function getMaxWeightDateUnix(): Promise<number | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const last = await db.weightHistory.orderBy('dateUnix').last()
    if (last == null) return null
    return last.dateUnix
  } catch {
    return null
  }
}

/**
 * Get one page of weight history, newest first. For paginated list.
 */
export async function getWeightHistoryPage(
  page: number,
  pageSize: number
): Promise<{ items: WeightEntry[]; total: number }> {
  const total = await db.weightHistory.count()
  const offset = Math.max(0, (page - 1) * pageSize)
  const items = await db.weightHistory
    .orderBy('dateUnix')
    .reverse()
    .offset(offset)
    .limit(pageSize)
    .toArray()
  return { items, total }
}

/**
 * Get weight entries in date range, ascending by date (for charts or list).
 */
export async function getWeightHistoryInRange(
  startDate: string,
  endDate: string,
  limit: number
): Promise<WeightEntry[]> {
  const raw = await db.weightHistory
    .where('date')
    .between(startDate, endDate, true, true)
    .limit(limit)
    .toArray()
  return raw.sort((a, b) => a.dateUnix - b.dateUnix)
}

/**
 * Get the weight (kg) that was in effect on or before a given date.
 * Used for KPS: each run should use the user's weight at the time of the run, not today's weight.
 * Returns null if no weight history entry exists on or before that date (caller uses current profile weight).
 */
export async function getWeightAtDate(runDate: string): Promise<number | null> {
  const entries = await db.weightHistory
    .where('date')
    .between('1970-01-01', runDate, true, true)
    .toArray()
  if (entries.length === 0) return null
  const latest = entries.reduce((a, b) => (a.date > b.date ? a : b))
  return latest.kg
}

/**
 * Batch weight lookup for many run dates. One IndexedDB query instead of N.
 * Returns Map<runDate, weightKg>. Use for chart builds with many runs.
 */
export async function getWeightsForDates(runDates: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(runDates)]
  if (unique.length === 0) return new Map()
  const maxDate = unique.reduce((a, b) => (a > b ? a : b))
  const entries = await db.weightHistory
    .where('date')
    .between('1970-01-01', maxDate, true, true)
    .toArray()
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const result = new Map<string, number>()
  for (const d of unique) {
    let best: WeightEntry | null = null
    for (const e of sorted) {
      if (e.date <= d) best = e
      else break
    }
    if (best != null && best.kg > 0) result.set(d, best.kg)
  }
  return result
}

/**
 * Backfill weightKg on runs that don't have it, using weight history. Run once after importing
 * weight history or for legacy runs. Call from the app (Settings); requires IndexedDB.
 */
export async function backfillRunWeights(): Promise<{ updated: number; skipped: number }> {
  const runs = await db.runs.toArray()
  let updated = 0
  let skipped = 0
  for (const run of runs) {
    if (run.weightKg != null && run.weightKg > 0) {
      skipped += 1
      continue
    }
    if (!run.id) continue
    const weight = await getWeightAtDate(run.date)
    if (weight != null && weight > 0) {
      await db.runs.update(run.id, { weightKg: weight })
      updated += 1
    } else {
      skipped += 1
    }
  }
  return { updated, skipped }
}
