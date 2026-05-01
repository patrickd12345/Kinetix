import { scopedSettingsLocalStorageKey } from './clientStorageScope'

/** Pre–user-namespace Zustand blob. */
export const LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY = 'kinetix-settings'

/**
 * Move unscoped settings into `kinetix-settings:<authUserId>` once, then remove legacy key.
 */
export function migrateLegacyUnscopedSettingsLocalStorage(authUserId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    const legacy = localStorage.getItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY)
    if (!legacy) return
    const scopedKey = scopedSettingsLocalStorageKey(authUserId)
    if (!localStorage.getItem(scopedKey)) {
      localStorage.setItem(scopedKey, scrubPersistedIntegrationCredentials(legacy))
    }
    localStorage.removeItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY)
  } catch {
    // ignore quota / private mode
  }
}

export function scrubPersistedIntegrationCredentials(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> }
    if (parsed.state && typeof parsed.state === 'object') {
      delete parsed.state.stravaToken
      delete parsed.state.stravaCredentials
      delete parsed.state.withingsCredentials
    }
    return JSON.stringify(parsed)
  } catch {
    return raw
  }
}
