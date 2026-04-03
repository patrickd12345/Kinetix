import type { UserProfile } from '@kinetix/core'
import type { PlatformProfileRecord } from './kinetixProfile'
import { toKinetixUserProfile } from './kinetixProfile'
import { useSettingsStore } from '../store/settingsStore'
import { getWeightAtDate } from './database'

let activePlatformProfile: PlatformProfileRecord | null = null

export function setActivePlatformProfile(profile: PlatformProfileRecord | null): void {
  activePlatformProfile = profile
}

export function getActivePlatformProfile(): PlatformProfileRecord | null {
  return activePlatformProfile
}

export function getActiveKinetixUserProfile(): UserProfile {
  if (!activePlatformProfile) {
    throw new Error('Platform profile is required before using Kinetix features.')
  }

  const base = toKinetixUserProfile(activePlatformProfile)
  const { weightSource, lastWithingsWeightKg } = useSettingsStore.getState()
  if (weightSource === 'withings' && lastWithingsWeightKg > 0) {
    return { ...base, weightKg: lastWithingsWeightKg }
  }
  return base
}

/**
 * Profile to use when calculating KPS for a run on a given date.
 * Uses weight history so that historical runs use the user's weight at that time, not today's.
 * Falls back to current profile weight if no weight entry exists on or before runDate.
 */
export async function getProfileForRunDate(runDate: string): Promise<UserProfile> {
  const current = getActiveKinetixUserProfile()
  const weightAtDate = await getWeightAtDate(runDate)
  if (weightAtDate != null && weightAtDate > 0) {
    return { ...current, weightKg: weightAtDate }
  }
  return current
}

/**
 * Profile to use when calculating KPS for a run.
 *
 * **Weight precedence:** IndexedDB weight history (e.g. Withings sync) wins over the per-run
 * `weightKg` snapshot. Snapshots are still used when there is no history on/before the run date
 * (legacy imports, offline, etc.).
 */
export async function getProfileForRun(run: { date: string; weightKg?: number | null }): Promise<UserProfile> {
  const current = getActiveKinetixUserProfile()
  const weightAtDate = await getWeightAtDate(run.date)
  if (weightAtDate != null && weightAtDate > 0) {
    return { ...current, weightKg: weightAtDate }
  }
  if (run.weightKg != null && run.weightKg > 0) {
    return { ...current, weightKg: run.weightKg }
  }
  return current
}

/**
 * Returns a getProfileForRun that uses a preloaded weight map. Avoids N IndexedDB queries when
 * building charts with many runs. Use with getWeightsForDates().
 */
export function createGetProfileForRunWithWeightCache(
  weightByDate: Map<string, number>
): (run: { date: string; weightKg?: number | null }) => Promise<UserProfile> {
  return async (run: { date: string; weightKg?: number | null }): Promise<UserProfile> => {
    const current = getActiveKinetixUserProfile()
    const w = weightByDate.get(run.date)
    if (w != null && w > 0) {
      return { ...current, weightKg: w }
    }
    if (run.weightKg != null && run.weightKg > 0) {
      return { ...current, weightKg: run.weightKg }
    }
    return current
  }
}
