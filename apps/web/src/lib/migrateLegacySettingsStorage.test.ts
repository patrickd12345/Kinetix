import { describe, it, expect, beforeEach } from 'vitest'
import { migrateLegacyUnscopedSettingsLocalStorage, LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY } from './migrateLegacySettingsStorage'
import { scopedSettingsLocalStorageKey } from './clientStorageScope'

describe('migrateLegacyUnscopedSettingsLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('copies legacy unscoped blob into scoped key once', () => {
    localStorage.setItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY, '{"state":{"targetKPS":99},"version":0}')
    const uid = 'user-a'
    migrateLegacyUnscopedSettingsLocalStorage(uid)
    expect(localStorage.getItem(scopedSettingsLocalStorageKey(uid))).toContain('"targetKPS":99')
    expect(localStorage.getItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY)).toBeNull()
  })

  it('does not overwrite existing scoped blob', () => {
    const uid = 'user-b'
    localStorage.setItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY, '{"state":{"targetKPS":1}}')
    localStorage.setItem(scopedSettingsLocalStorageKey(uid), '{"state":{"targetKPS":88}}')
    migrateLegacyUnscopedSettingsLocalStorage(uid)
    expect(localStorage.getItem(scopedSettingsLocalStorageKey(uid))).toContain('"targetKPS":88')
    expect(localStorage.getItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY)).toBeNull()
  })

  it('scrubs legacy integration credential material before copying settings', () => {
    const uid = 'user-c'
    localStorage.setItem(
      LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY,
      JSON.stringify({
        state: {
          targetKPS: 101,
          stravaToken: 'legacy-manual-token',
          stravaCredentials: {
            accessToken: 'strava-access',
            refreshToken: 'strava-refresh',
            expiresAt: 1_800_000_000,
          },
          withingsCredentials: {
            accessToken: 'withings-access',
            refreshToken: 'withings-refresh',
            expiresAt: 1_800_000_000_000,
            userId: 'withings-user',
          },
        },
        version: 0,
      })
    )

    migrateLegacyUnscopedSettingsLocalStorage(uid)

    const scoped = localStorage.getItem(scopedSettingsLocalStorageKey(uid))
    expect(scoped).toContain('"targetKPS":101')
    expect(scoped).not.toContain('legacy-manual-token')
    expect(scoped).not.toContain('strava-refresh')
    expect(scoped).not.toContain('withings-refresh')
    expect(localStorage.getItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY)).toBeNull()
  })
})
