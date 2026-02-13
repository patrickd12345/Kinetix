import type { UserProfile } from '@kinetix/core'
import type { PlatformProfileRecord } from './kinetixProfile'
import { toKinetixUserProfile } from './kinetixProfile'

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

  return toKinetixUserProfile(activePlatformProfile)
}
