/** Pre-user-namespace Zustand blob. */
export const LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY = 'kinetix-settings'

/**
 * BKI-034: legacy unscoped settings are intentionally left untouched.
 * They must not be silently assigned to whichever account signs in next.
 */
export function migrateLegacyUnscopedSettingsLocalStorage(authUserId: string): void {
  void authUserId
}
