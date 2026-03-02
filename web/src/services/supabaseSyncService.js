import { getSupabaseClient } from './supabaseClient'
import { StorageService } from '../storage/local/storageService'
import { Run } from '../models/Run'

const RUNS_TABLE = 'runs'

function toRunRow(run) {
  const date = run.date instanceof Date ? run.date.toISOString() : run.date
  return {
    id: run.id,
    date,
    source: run.source || 'strava',
    distance_m: run.distance,
    duration_s: run.duration,
    avg_pace_skm: run.avgPace,
    avg_npi: run.avgNPI,
    avg_hr: run.avgHeartRate,
    avg_cadence: run.avgCadence,
    elevation_gain_m: run.elevationGain ?? 0,
    strava_id: run.stravaId ?? null,
    strava_name: run.stravaName ?? null,
    strava_description: run.stravaDescription ?? null,
    updated_at: new Date().toISOString(),
  }
}

function fromRunRow(row) {
  return {
    id: row.id,
    date: row.date,
    source: row.source,
    distance: row.distance_m,
    duration: row.duration_s,
    avgPace: row.avg_pace_skm,
    avgNPI: row.avg_npi,
    avgHeartRate: row.avg_hr ?? 0,
    avgCadence: row.avg_cadence,
    elevationGain: row.elevation_gain_m ?? 0,
    stravaId: row.strava_id,
    stravaName: row.strava_name,
    stravaDescription: row.strava_description,
  }
}

export const supabaseSyncService = {
  isConfigured() {
    return !!getSupabaseClient()
  },

  async getUser() {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    const { data } = await supabase.auth.getUser()
    return data?.user ?? null
  },

  async signInWithGoogle() {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Supabase not configured')
    const redirectTo = window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  },

  async signOut() {
    const supabase = getSupabaseClient()
    if (!supabase) return
    await supabase.auth.signOut()
  },

  async pullRuns() {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
      .from(RUNS_TABLE)
      .select('*')
      .order('date', { ascending: false })
    if (error) throw error

    let imported = 0
    for (const row of data || []) {
      const run = new Run(fromRunRow(row))
      const saved = await StorageService.saveRun(run)
      if (saved) imported++
    }
    return imported
  },

  async pushRuns() {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Supabase not configured')
    const localRuns = await StorageService.getAllRuns()
    const rows = localRuns.map(toRunRow)
    if (!rows.length) return 0
    const { error } = await supabase.from(RUNS_TABLE).upsert(rows, { onConflict: 'id' })
    if (error) throw error
    return rows.length
  },
}
