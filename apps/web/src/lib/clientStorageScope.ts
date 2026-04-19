/**
 * Deterministic auth-scoped client storage keys (Supabase `session.user.id`).
 * Intentionally global keys are documented in docs/global-client-storage.md.
 */

export const SETTINGS_SCOPED_PREFIX = 'kinetix-settings:'

export function scopedSettingsLocalStorageKey(authUserId: string): string {
  return `${SETTINGS_SCOPED_PREFIX}${authUserId}`
}
export const COACH_MEMORY_PREFIX = 'kinetix-coach-memory-v1:'
export const RAG_SYNC_SESSION_PREFIX = 'kinetix_rag_sync_'

/** OAuth redirect dedupe (Settings OAuth callback). */
export function oauthDedupeSessionKey(provider: 'strava' | 'withings', authUserId: string): string {
  return `${provider}_oauth_code:${authUserId}`
}

export function ragFailStreakSessionKey(authUserId: string): string {
  return `${RAG_SYNC_SESSION_PREFIX}fail_streak:${authUserId}`
}

export function ragBannerDismissedSessionKey(authUserId: string): string {
  return `${RAG_SYNC_SESSION_PREFIX}banner_dismissed:${authUserId}`
}

export function coachMemoryStorageKey(authUserId: string): string {
  return `${COACH_MEMORY_PREFIX}${authUserId}`
}

/** Legacy unscoped coach memory (pre–user-namespace). */
export const LEGACY_COACH_MEMORY_KEY = 'kinetix-coach-memory-v1'
