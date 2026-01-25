import Dexie, { Table } from 'dexie'

export interface RunRecord {
  id?: number
  date: string
  distance: number // meters
  duration: number // seconds
  averagePace: number // seconds per km
  npi: number
  targetNPI: number
  locations: Array<{ lat: number; lon: number; timestamp: number }>
  splits: Array<{ distance: number; time: number; pace: number }>
  heartRate?: number
  notes?: string
  tags?: string[]
  source?: string
}

class KinetixDatabase extends Dexie {
  runs!: Table<RunRecord>

  constructor() {
    super('KinetixDB')
    this.version(1).stores({
      runs: '++id, date, npi, distance',
    })
  }
}

export const db = new KinetixDatabase()
