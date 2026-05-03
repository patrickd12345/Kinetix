import { RunRecord } from './database'





export type AchievementLabel =
  | 'KPS PB'
  | 'Longest distance'
  | 'First half marathon'
  | 'First marathon'

export const HALF_MARATHON_KM = 21.0975
export const MARATHON_KM = 42.195

/**
 * Calculates the achievements for a given run by comparing it to all *previous* runs.
 * Note: `previousRuns` must strictly be runs that occurred *before* the `targetRun` chronologically.
 */
export function calculateAchievementsSync(
  targetRun: RunRecord,
  previousRuns: RunRecord[],
  targetRunAbsoluteKps: number,
  previousRunsAbsoluteKpsMap: Map<number, number>
): AchievementLabel[] {
  const achievements: AchievementLabel[] = []

  // Check KPS PB
  let isKpsPb = true
  for (const prevRun of previousRuns) {
    if (prevRun.id) {
      const prevKps = previousRunsAbsoluteKpsMap.get(prevRun.id) ?? 0
      if (prevKps >= targetRunAbsoluteKps) {
        isKpsPb = false
        break
      }
    }
  }
  if (isKpsPb && previousRuns.length > 0) {
    achievements.push('KPS PB')
  } else if (isKpsPb && previousRuns.length === 0) {
     // First run is technically a PB, but we might not want to label it as such. Let's omit.
  }

  // Check Longest Distance
  let isLongestDistance = true
  for (const prevRun of previousRuns) {
    if (prevRun.distance >= targetRun.distance) {
      isLongestDistance = false
      break
    }
  }
  if (isLongestDistance && previousRuns.length > 0) {
    achievements.push('Longest distance')
  }

  const targetKm = targetRun.distance / 1000

  // Check First Marathon
  if (targetKm >= MARATHON_KM) {
    const hasMarathon = previousRuns.some((prev) => prev.distance / 1000 >= MARATHON_KM)
    if (!hasMarathon) {
      achievements.push('First marathon')
    }
  }

  // Check First Half Marathon
  if (targetKm >= HALF_MARATHON_KM) {
    const hasHalfMarathon = previousRuns.some((prev) => prev.distance / 1000 >= HALF_MARATHON_KM)
    if (!hasHalfMarathon) {
      achievements.push('First half marathon')
    }
  }

  return achievements
}

export function getPrimaryAchievement(achievements: AchievementLabel[]): AchievementLabel | null {
  if (achievements.includes('KPS PB')) return 'KPS PB'
  if (achievements.includes('First marathon')) return 'First marathon'
  if (achievements.includes('First half marathon')) return 'First half marathon'
  if (achievements.includes('Longest distance')) return 'Longest distance'
  return null
}
