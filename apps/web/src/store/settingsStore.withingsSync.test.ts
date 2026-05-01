import { beforeEach, describe, expect, it } from 'vitest'
import { scopedSettingsLocalStorageKey } from '../lib/clientStorageScope'
import { setSettingsPersistUserId } from './settingsScopedStorage'
import { useSettingsStore } from './settingsStore'

const TEST_SETTINGS_USER = 'withings-settings-test-user'

describe('settingsStore withings expanded sync settings', () => {
  beforeEach(async () => {
    localStorage.clear()
    setSettingsPersistUserId(TEST_SETTINGS_USER)
    await useSettingsStore.persist.rehydrate()
    useSettingsStore.setState({
      withingsExpandedSyncEnabled: false,
      withingsSyncTimes: ['08:00', '20:00'],
      lastSuccessfulWithingsSyncAt: null,
      lastSuccessfulWithingsScheduledSlotKey: null,
      lastSuccessfulWithingsStartupSyncDate: null,
      withingsStartupSyncInFlight: false,
      withingsStartupSyncError: null,
    })
  })

  it('defaults schedule to 08:00 and 20:00', () => {
    const state = useSettingsStore.getState()
    expect(state.withingsSyncTimes).toEqual(['08:00', '20:00'])
    expect(state.withingsExpandedSyncEnabled).toBe(false)
  })

  it('persists expanded sync settings', () => {
    useSettingsStore.getState().setWithingsExpandedSyncEnabled(true)
    useSettingsStore.getState().setWithingsSyncTimes(['07:30', '19:45'])
    useSettingsStore.getState().setLastSuccessfulWithingsSyncAt('2026-04-09T08:05:00.000Z')
    useSettingsStore.getState().setLastSuccessfulWithingsScheduledSlotKey('2026-04-09@08:00')
    useSettingsStore.getState().setLastSuccessfulWithingsStartupSyncDate('2026-04-09')
    useSettingsStore.getState().setWithingsStartupSyncInFlight(true)
    useSettingsStore.getState().setWithingsStartupSyncError('temporary failure')

    const raw = localStorage.getItem(scopedSettingsLocalStorageKey(TEST_SETTINGS_USER))
    expect(raw).toBeTruthy()
    const parsed = raw ? JSON.parse(raw) : null
    const state = parsed?.state
    expect(state.withingsExpandedSyncEnabled).toBe(true)
    expect(state.withingsSyncTimes).toEqual(['07:30', '19:45'])
    expect(state.lastSuccessfulWithingsScheduledSlotKey).toBe('2026-04-09@08:00')
    expect(state.lastSuccessfulWithingsStartupSyncDate).toBe('2026-04-09')
    expect(state.withingsStartupSyncInFlight).toBeUndefined()
    expect(state.withingsStartupSyncError).toBeUndefined()
  })

  it('does not persist Strava or Withings credential material to localStorage', () => {
    useSettingsStore.getState().setStravaToken('legacy-manual-token')
    useSettingsStore.getState().setStravaCredentials({
      accessToken: 'strava-access',
      refreshToken: 'strava-refresh',
      expiresAt: 1_800_000_000,
    })
    useSettingsStore.getState().setWithingsCredentials({
      accessToken: 'withings-access',
      refreshToken: 'withings-refresh',
      userId: 'withings-user',
      expiresAt: 1_800_000_000_000,
    })

    const raw = localStorage.getItem(scopedSettingsLocalStorageKey(TEST_SETTINGS_USER))
    expect(raw).toBeTruthy()
    const parsed = raw ? JSON.parse(raw) : null
    const state = parsed?.state
    expect(state.stravaToken).toBeUndefined()
    expect(state.stravaCredentials).toBeUndefined()
    expect(state.withingsCredentials).toBeUndefined()
    expect(raw).not.toContain('legacy-manual-token')
    expect(raw).not.toContain('strava-refresh')
    expect(raw).not.toContain('withings-refresh')
  })

  it('drops legacy persisted Strava and Withings credentials during rehydrate', async () => {
    localStorage.setItem(
      scopedSettingsLocalStorageKey(TEST_SETTINGS_USER),
      JSON.stringify({
        state: {
          targetKPS: 100,
          stravaToken: 'legacy-manual-token',
          stravaCredentials: {
            accessToken: 'strava-access',
            refreshToken: 'strava-refresh',
            expiresAt: 1_800_000_000,
          },
          withingsCredentials: {
            accessToken: 'withings-access',
            refreshToken: 'withings-refresh',
            userId: 'withings-user',
            expiresAt: 1_800_000_000_000,
          },
        },
        version: 0,
      })
    )

    await useSettingsStore.persist.rehydrate()

    const state = useSettingsStore.getState()
    expect(state.targetKPS).toBe(100)
    expect(state.stravaToken).toBe('')
    expect(state.stravaCredentials).toBeNull()
    expect(state.withingsCredentials).toBeNull()
  })
})
