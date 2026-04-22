import type { PlannedRace } from '../plannedRaces'

export type RacePhase = 'build' | 'specific' | 'taper' | 'race_ready' | 'post_race_recovery' | null
export type IntensityAdjustment = 'normal' | 'reduce_volume' | 'reduce_intensity' | 'sharpen' | 'recover' | null
export type RaceDistanceBucket = 'short' | 'medium' | 'long'

export interface PlannedRaceCoachingContext {
  hasUpcomingRace: boolean
  phase: RacePhase
  raceName: string | null
  raceDate: string | null
  raceDistanceMeters: number | null
  goalTimeSeconds: number | null
  daysToRace: number | null
  headline: string | null
  guidance: string[]
  intensityAdjustment: IntensityAdjustment
}

export function computeRacePhase(daysToRace: number): RacePhase {
  if (daysToRace > 42) return 'build'
  if (daysToRace >= 15 && daysToRace <= 42) return 'specific'
  if (daysToRace >= 3 && daysToRace <= 14) return 'taper'
  if (daysToRace >= 0 && daysToRace <= 2) return 'race_ready'
  if (daysToRace >= -3 && daysToRace <= -1) return 'post_race_recovery'
  return null
}

export function getRaceDistanceBucket(distanceMeters: number): RaceDistanceBucket {
  if (distanceMeters < 8000) return 'short'
  if (distanceMeters >= 8000 && distanceMeters <= 25000) return 'medium'
  return 'long'
}

function getPhaseIntensityAdjustment(phase: RacePhase): IntensityAdjustment {
  switch (phase) {
    case 'build': return 'normal'
    case 'specific': return 'sharpen'
    case 'taper': return 'reduce_volume'
    case 'race_ready': return 'reduce_intensity'
    case 'post_race_recovery': return 'recover'
    default: return null
  }
}

function getGuidanceForPhaseAndDistance(phase: RacePhase, bucket: RaceDistanceBucket): string[] {
  const guidance: string[] = []

  if (phase === 'build') {
    if (bucket === 'short') guidance.push('Focus on speed economy and threshold building.')
    if (bucket === 'medium') guidance.push('Focus on sustained pace control and threshold endurance.')
    if (bucket === 'long') guidance.push('Focus on endurance preservation and fueling strategies.')
  } else if (phase === 'specific') {
    if (bucket === 'short') guidance.push('Prioritize threshold work and cadence economy.')
    if (bucket === 'medium') guidance.push('Incorporate race-specific pace control and sustained threshold intervals.')
    if (bucket === 'long') guidance.push('Focus on long endurance efforts, fueling, and conservative tapering.')
  } else if (phase === 'taper') {
    guidance.push('Reduce overall volume to shed fatigue.')
    if (bucket === 'short') guidance.push('Maintain light speed economy work to stay sharp.')
    if (bucket === 'medium') guidance.push('Preserve sustained pace confidence without adding overload.')
    if (bucket === 'long') guidance.push('Prioritize rest, light runs, and conservative tapering.')
  } else if (phase === 'race_ready') {
    guidance.push('Avoid heavy workouts.')
    guidance.push('Focus on easy runs, rest, strides, and fueling readiness.')
  } else if (phase === 'post_race_recovery') {
    guidance.push('Focus on easy movement and rest only.')
    guidance.push('Allow your body to recover from the race effort.')
  }

  return guidance
}

/**
 * Returns a deterministic, local YYYY-MM-DD string for a Date.
 */
export function toLocalDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculates days to race using local calendar day semantics.
 * @param raceDate YYYY-MM-DD string
 * @param todayLocalDate YYYY-MM-DD string
 */
export function getDaysToRace(raceDate: string, todayLocalDate: string): number {
  const [ry, rm, rd] = raceDate.split('-').map(Number)
  const [ty, tm, td] = todayLocalDate.split('-').map(Number)

  // Use UTC to calculate days diff safely without local timezone DST drift
  const raceUTC = Date.UTC(ry, rm - 1, rd)
  const todayUTC = Date.UTC(ty, tm - 1, td)

  const diffTime = raceUTC - todayUTC
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export function getNextRelevantRace(plannedRaces: PlannedRace[], todayLocalDate: string): PlannedRace | null {
  const upcomingRaces = plannedRaces.filter(race => race.race_date >= todayLocalDate || getDaysToRace(race.race_date, todayLocalDate) >= -3)

  if (upcomingRaces.length === 0) return null

  upcomingRaces.sort((a, b) => {
    if (a.race_date !== b.race_date) {
      return a.race_date.localeCompare(b.race_date)
    }
    // Longer distance wins on ties
    return b.distance_meters - a.distance_meters
  })

  return upcomingRaces[0]
}

export function buildPlannedRaceCoachingContext(nextRace: PlannedRace | null, todayLocalDate: string): PlannedRaceCoachingContext {
  if (!nextRace) {
    return {
      hasUpcomingRace: false,
      phase: null,
      raceName: null,
      raceDate: null,
      raceDistanceMeters: null,
      goalTimeSeconds: null,
      daysToRace: null,
      headline: null,
      guidance: [],
      intensityAdjustment: null,
    }
  }

  const daysToRace = getDaysToRace(nextRace.race_date, todayLocalDate)
  const phase = computeRacePhase(daysToRace)
  const distanceBucket = getRaceDistanceBucket(nextRace.distance_meters)

  let headline = 'Upcoming Race'
  if (phase === 'post_race_recovery') headline = 'Post-Race Recovery'
  else if (phase === 'race_ready') headline = 'Race Ready'
  else if (phase === 'taper') headline = 'Tapering Phase'
  else if (phase === 'specific') headline = 'Race-Specific Phase'
  else if (phase === 'build') headline = 'Build Phase'

  return {
    hasUpcomingRace: true,
    phase,
    raceName: nextRace.race_name,
    raceDate: nextRace.race_date,
    raceDistanceMeters: nextRace.distance_meters,
    goalTimeSeconds: nextRace.goal_time_seconds,
    daysToRace,
    headline,
    guidance: getGuidanceForPhaseAndDistance(phase, distanceBucket),
    intensityAdjustment: getPhaseIntensityAdjustment(phase),
  }
}
