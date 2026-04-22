import { supabase } from './supabaseClient'

export interface PlannedRace {
  id: string
  profile_id: string
  race_name: string
  race_date: string // YYYY-MM-DD
  distance_meters: number
  goal_time_seconds: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type CreatePlannedRaceInput = Omit<PlannedRace, 'id' | 'profile_id' | 'created_at' | 'updated_at'>
export type UpdatePlannedRaceInput = Partial<CreatePlannedRaceInput>

export async function listPlannedRacesForProfile(profileId: string): Promise<PlannedRace[]> {
  if (!supabase) throw new Error('Supabase client not initialized')

  const { data, error } = await supabase
    .schema('kinetix')
    .from('planned_races')
    .select('*')
    .eq('profile_id', profileId)
    .order('race_date', { ascending: true })
    .order('distance_meters', { ascending: false })

  if (error) throw new Error(`Failed to list planned races: ${error.message}`)
  return data as PlannedRace[]
}

export async function createPlannedRace(profileId: string, input: CreatePlannedRaceInput): Promise<PlannedRace> {
  if (!supabase) throw new Error('Supabase client not initialized')

  const { data, error } = await supabase
    .schema('kinetix')
    .from('planned_races')
    .insert([{ profile_id: profileId, ...input }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create planned race: ${error.message}`)
  return data as PlannedRace
}

export async function updatePlannedRace(profileId: string, raceId: string, input: UpdatePlannedRaceInput): Promise<PlannedRace> {
  if (!supabase) throw new Error('Supabase client not initialized')

  const { data, error } = await supabase
    .schema('kinetix')
    .from('planned_races')
    .update(input)
    .eq('id', raceId)
    .eq('profile_id', profileId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update planned race: ${error.message}`)
  return data as PlannedRace
}

export async function deletePlannedRace(profileId: string, raceId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized')

  const { error } = await supabase
    .schema('kinetix')
    .from('planned_races')
    .delete()
    .eq('id', raceId)
    .eq('profile_id', profileId)

  if (error) throw new Error(`Failed to delete planned race: ${error.message}`)
}
