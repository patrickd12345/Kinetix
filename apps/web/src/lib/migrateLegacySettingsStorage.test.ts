import { describe, it, expect, beforeEach } from 'vitest'
import { migrateLegacyUnscopedSettingsLocalStorage, LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY } from './migrateLegacySettingsStorage'
import { scopedSettingsLocalStorageKey } from './clientStorageScope'

describe('migrateLegacyUnscopedSettingsLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('leaves legacy unscoped settings untouched and does not assign them to the current user', () => {
    localStorage.setItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY, '{"state":{"targetKPS":99},"version":0}')
    const uid = 'user-a'
    migrateLegacyUnscopedSettingsLocalStorage(uid)
    expect(localStorage.getItem(scopedSettingsLocalStorageKey(uid))).toBeNull()
    expect(localStorage.getItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY)).toContain('"targetKPS":99')
  })

  it('keeps existing scoped settings and still leaves legacy untouched', () => {
    const uid = 'user-b'
    localStorage.setItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY, '{"state":{"targetKPS":1}}')
    localStorage.setItem(scopedSettingsLocalStorageKey(uid), '{"state":{"targetKPS":88}}')
    migrateLegacyUnscopedSettingsLocalStorage(uid)
    expect(localStorage.getItem(scopedSettingsLocalStorageKey(uid))).toContain('"targetKPS":88')
    expect(localStorage.getItem(LEGACY_UNSCOPED_SETTINGS_LOCAL_KEY)).toContain('"targetKPS":1')
  })
})
