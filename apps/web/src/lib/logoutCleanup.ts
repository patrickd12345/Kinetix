import {
  oauthDedupeSessionKey,
  ragBannerDismissedSessionKey,
  ragFailStreakSessionKey,
} from './clientStorageScope'
import { clearHistoryKpsDerivedCache, clearHistoryKpsDerivedStorage } from './historyKpsDerivedCache'

/**
 * Clears OAuth dedupe markers and volatile session caches for the signing-out user.
 * Does not remove scoped durable preferences under `kinetix-settings:<userId>` —
 * caller should run {@link clearSensitiveSettingsForLogout} before this so tokens are cleared in storage.
 */
export function clearLogoutSessionArtifacts(authUserId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(oauthDedupeSessionKey('strava', authUserId))
    sessionStorage.removeItem(oauthDedupeSessionKey('withings', authUserId))
    sessionStorage.removeItem(ragFailStreakSessionKey(authUserId))
    sessionStorage.removeItem(ragBannerDismissedSessionKey(authUserId))
  } catch {
    // ignore
  }
}

export function clearVolatileHistoryKpsCaches(authUserId: string): void {
  clearHistoryKpsDerivedCache()
  clearHistoryKpsDerivedStorage(authUserId)
}
