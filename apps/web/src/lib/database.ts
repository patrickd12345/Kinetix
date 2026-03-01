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
  kps: number // Kinetix Performance Score (absolute)
  targetKPS: number
  locations: Array<{ lat: number; lon: number; timestamp: number }>
  splits: Array<{ distance: number; time: number; pace: number }>
  heartRate?: number
  notes?: string
  tags?: string[]
  source?: string
  /** 0 = visible, 1 = hidden (logical delete). Omit/undefined treated as 0. */
  deleted?: 0 | 1
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

class KinetixDatabase extends Dexie {
  runs!: Table<RunRecord>
  pb!: Table<PBRecord>

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
