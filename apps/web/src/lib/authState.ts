import type { UserProfile } from '@kinetix/core'
import type { PlatformProfileRecord } from './kinetixProfile'
import { toKinetixUserProfile } from './kinetixProfile'
import { useSettingsStore } from '../store/settingsStore'

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
