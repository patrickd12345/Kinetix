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
})
