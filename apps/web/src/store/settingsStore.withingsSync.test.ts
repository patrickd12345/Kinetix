import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from './settingsStore'

describe('settingsStore withings expanded sync settings', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({
      withingsExpandedSyncEnabled: false,
      withingsSyncTimes: ['08:00', '20:00'],
      lastSuccessfulWithingsSyncAt: null,
      lastSuccessfulWithingsScheduledSlotKey: null,
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

    const raw = localStorage.getItem('kinetix-settings')
    expect(raw).toBeTruthy()
    const parsed = raw ? JSON.parse(raw) : null
    const state = parsed?.state
    expect(state.withingsExpandedSyncEnabled).toBe(true)
    expect(state.withingsSyncTimes).toEqual(['07:30', '19:45'])
    expect(state.lastSuccessfulWithingsScheduledSlotKey).toBe('2026-04-09@08:00')
  })
})
