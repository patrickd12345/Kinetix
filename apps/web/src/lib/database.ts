import Dexie, { Table } from 'dexie'

export interface RunRecord {
  id?: number
  date: string
  distance: number // meters
  duration: number // seconds
  averagePace: number // seconds per km
  kps: number // 0–100
  targetKps: number // 0–100
  set_pb: boolean
  locations: Array<{ lat: number; lon: number; timestamp: number }>
  splits: Array<{ distance: number; time: number; pace: number }>
  heartRate?: number
  notes?: string
  tags?: string[]
  source?: string
}

export interface KpsStateRecord {
  id: 'kps'
  pb_eq5k_sec: number
}

class KinetixDatabase extends Dexie {
  runs!: Table<RunRecord>
  meta!: Table<KpsStateRecord>

  constructor() {
    super('KinetixDB')
    this.version(1).stores({
      runs: '++id, date, distance',
    })

    // v2: canonize KPS + PB reference storage
    this.version(2)
      .stores({
        runs: '++id, date, kps, distance, set_pb',
        meta: 'id',
      })
      .upgrade(async (tx) => {
        // One-time migration: compute KPS for existing runs in chronological order
        // using a progressive PB reference (append-only ledger semantics).
        const runsTable = tx.table('runs') as Dexie.Table<any, any>
        const metaTable = tx.table('meta') as Dexie.Table<any, any>

        const allRuns = await runsTable.toArray()
        if (!Array.isArray(allRuns) || allRuns.length === 0) return

        allRuns.sort((a, b) => {
          const at = new Date(a.date).getTime()
          const bt = new Date(b.date).getTime()
          return at - bt
        })

        // Lazy import to avoid circular deps during Dexie init
        const { computeKpsWithPb } = await import('@kinetix/core')

        let pbEq5kSec: number | null = null

        for (const run of allRuns) {
          const distanceKm = (run.distance ?? 0) / 1000
          const timeSeconds = run.duration ?? 0
          const { kps, pbEq5kSecNext, setPb } = computeKpsWithPb({
            distanceKm,
            timeSeconds,
            pbEq5kSec,
          })
          pbEq5kSec = pbEq5kSecNext

          // Store new canonical fields without deleting legacy fields.
          await runsTable.update(run.id, {
            kps,
            targetKps: run.targetKps ?? 95,
            set_pb: Boolean(setPb),
          })
        }

        if (pbEq5kSec != null && Number.isFinite(pbEq5kSec) && pbEq5kSec > 0) {
          await metaTable.put({ id: 'kps', pb_eq5k_sec: pbEq5kSec })
        }
      })
  }
}

export const db = new KinetixDatabase()
