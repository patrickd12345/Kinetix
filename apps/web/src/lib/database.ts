import Dexie, { Table } from 'dexie'
import { UserProfile } from '@kinetix/core'

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
  }
}

export const db = new KinetixDatabase()

const RUNS_ORDERED = () => db.runs.orderBy('date').reverse()

/**
 * Fetch one page of runs (newest first) and total count. Use for History pagination.
 */
export async function getRunsPage(
  page: number,
  pageSize: number
): Promise<{ items: RunRecord[]; total: number }> {
  const total = await db.runs.count()
  const offset = Math.max(0, (page - 1) * pageSize)
  const items = await RUNS_ORDERED().offset(offset).limit(pageSize).toArray()
  return { items, total }
}

/**
 * Return 1-based page number that contains the run at or just after the given date (in date-desc order).
 * Used for date-jump: go to the page that would contain that run.
 */
export async function getRunsPageForDate(
  selectedDateStr: string,
  pageSize: number
): Promise<number> {
  const total = await db.runs.count()
  if (total === 0) return 1
  const totalPages = Math.ceil(total / pageSize)
  const runsWithNewerDate = await db.runs.where('date').above(selectedDateStr).count()
  const index = runsWithNewerDate
  const page = Math.min(totalPages, Math.max(1, Math.floor(index / pageSize) + 1))
  return page
}
