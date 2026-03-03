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
 * Profile to use when calculating KPS for a run. Uses stored run.weightKg when present (avoids
 * weight history lookup); otherwise resolves via getProfileForRunDate(run.date).
 */
export async function getProfileForRun(run: { date: string; weightKg?: number | null }): Promise<UserProfile> {
  if (run.weightKg != null && run.weightKg > 0) {
    const current = getActiveKinetixUserProfile()
    return { ...current, weightKg: run.weightKg }
  }
  return getProfileForRunDate(run.date)
}
