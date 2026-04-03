import { useMemo, useRef } from 'react'
import type { UserProfile } from '@kinetix/core'
import type { PlatformProfileRecord } from '../lib/kinetixProfile'
import { toKinetixUserProfile } from '../lib/kinetixProfile'

/**
 * Stable {@link UserProfile} for effect deps. The auth `profile` object can change
 * reference without semantic changes; depending on `[profile]` caused unnecessary
 * effect reruns (chart reload, loading flashes).
 */
export function useStableKinetixUserProfile(profile: PlatformProfileRecord | null): UserProfile | null {
  const profileRef = useRef(profile)
  profileRef.current = profile

  const m = profile?.metadata as Record<string, unknown> | null | undefined
  const signature = [
    profile?.id ?? '',
    profile?.age ?? '',
    profile?.weight_kg ?? '',
    profile?.weightKg ?? '',
    m?.age ?? '',
    m?.weight_kg ?? '',
    m?.weightKg ?? '',
  ].join('|')

  return useMemo(() => {
    if (!signature) return null
    const p = profileRef.current
    if (!p) return null
    return toKinetixUserProfile(p)
  }, [signature])
}
