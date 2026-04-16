import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runWithingsStartupReload } from './startupSync'
import type { WithingsCredentials } from '../../../store/settingsStore'

const syncWithingsDataMock = vi.fn()
const syncWithingsWeightsAtStartupMock = vi.fn()

vi.mock('./sync', () => ({
  syncWithingsData: (...args: unknown[]) => syncWithingsDataMock(...args),
}))

vi.mock('../../withings', () => ({
  WITHINGS_WEIGHTS_SYNCED_EVENT: 'kinetix:withingsWeightsSynced',
  syncWithingsWeightsAtStartup: (...args: unknown[]) => syncWithingsWeightsAtStartupMock(...args),
}))

const credentials: WithingsCredentials = {
  accessToken: 'access',
  refreshToken: 'refresh',
  userId: 'withings-user',
  expiresAt: Date.now() + 60_000,
}

function makeActions() {
  return {
    setWithingsCredentials: vi.fn(),
    setLastWithingsWeightKg: vi.fn(),
    setLastSuccessfulWithingsSyncAt: vi.fn(),
    setLastSuccessfulWithingsScheduledSlotKey: vi.fn(),
    setLastSuccessfulWithingsStartupSyncDate: vi.fn(),
    dispatchWeightsSynced: vi.fn(),
  }
}

describe('runWithingsStartupReload', () => {
  beforeEach(() => {
    syncWithingsDataMock.mockReset()
    syncWithingsWeightsAtStartupMock.mockReset()
    syncWithingsWeightsAtStartupMock.mockResolvedValue({ latestKg: 70.25, historyEntriesSynced: 3 })
  })

  it('skips startup reload without Withings credentials', async () => {
    const actions = makeActions()

    const result = await runWithingsStartupReload(
      {
        withingsCredentials: null,
        withingsExpandedSyncEnabled: true,
        withingsSyncTimes: ['08:00', '20:00'],
        lastSuccessfulWithingsScheduledSlotKey: null,
        lastSuccessfulWithingsStartupSyncDate: null,
      },
      actions,
      new Date('2026-04-11T09:00:00'),
      true
    )

    expect(result).toMatchObject({ started: false, skippedReason: 'missing_connection' })
    expect(syncWithingsDataMock).not.toHaveBeenCalled()
    expect(syncWithingsWeightsAtStartupMock).not.toHaveBeenCalled()
  })

  it('still refreshes weight on the same local day without re-running expanded sync', async () => {
    const actions = makeActions()

    const result = await runWithingsStartupReload(
      {
        withingsCredentials: credentials,
        withingsExpandedSyncEnabled: true,
        withingsSyncTimes: ['08:00', '20:00'],
        lastSuccessfulWithingsScheduledSlotKey: null,
        lastSuccessfulWithingsStartupSyncDate: '2026-04-11',
      },
      actions,
      new Date('2026-04-11T09:00:00'),
      true
    )

    expect(result).toMatchObject({ started: true, expandedSyncRan: false, historyEntriesSynced: 3, latestKg: 70.25 })
    expect(syncWithingsDataMock).not.toHaveBeenCalled()
    expect(syncWithingsWeightsAtStartupMock).toHaveBeenCalledTimes(1)
    expect(actions.setLastWithingsWeightKg).toHaveBeenCalledWith(70.25)
    expect(actions.setLastSuccessfulWithingsStartupSyncDate).not.toHaveBeenCalled()
  })

  it('runs scheduled expanded sync and refreshes weight history once due', async () => {
    const actions = makeActions()

    const result = await runWithingsStartupReload(
      {
        withingsCredentials: credentials,
        withingsExpandedSyncEnabled: true,
        withingsSyncTimes: ['08:00', '20:00'],
        lastSuccessfulWithingsScheduledSlotKey: null,
        lastSuccessfulWithingsStartupSyncDate: null,
      },
      actions,
      new Date('2026-04-11T09:00:00'),
      true
    )

    expect(result).toMatchObject({ started: true, expandedSyncRan: true, historyEntriesSynced: 3, latestKg: 70.25 })
    expect(syncWithingsDataMock).toHaveBeenCalledWith(credentials)
    expect(syncWithingsWeightsAtStartupMock).toHaveBeenCalledWith(credentials, actions.setWithingsCredentials)
    expect(actions.setLastWithingsWeightKg).toHaveBeenCalledWith(70.25)
    expect(actions.dispatchWeightsSynced).toHaveBeenCalledTimes(1)
    expect(actions.setLastSuccessfulWithingsSyncAt).toHaveBeenCalledWith(new Date('2026-04-11T09:00:00').toISOString())
    expect(actions.setLastSuccessfulWithingsScheduledSlotKey).toHaveBeenCalledWith('2026-04-11@08:00')
    expect(actions.setLastSuccessfulWithingsStartupSyncDate).toHaveBeenCalledWith('2026-04-11')
  })

  it('refreshes weight history without expanded sync when the schedule is not due', async () => {
    const actions = makeActions()

    const result = await runWithingsStartupReload(
      {
        withingsCredentials: credentials,
        withingsExpandedSyncEnabled: true,
        withingsSyncTimes: ['08:00', '20:00'],
        lastSuccessfulWithingsScheduledSlotKey: null,
        lastSuccessfulWithingsStartupSyncDate: null,
      },
      actions,
      new Date('2026-04-11T07:00:00'),
      true
    )

    expect(result).toMatchObject({ started: true, expandedSyncRan: false })
    expect(syncWithingsDataMock).not.toHaveBeenCalled()
    expect(syncWithingsWeightsAtStartupMock).toHaveBeenCalledTimes(1)
    expect(actions.setLastSuccessfulWithingsStartupSyncDate).toHaveBeenCalledWith('2026-04-11')
  })

  it('continues to refresh weight when expanded sync fails', async () => {
    const actions = makeActions()
    syncWithingsDataMock.mockRejectedValueOnce(new Error('expanded failed'))

    const result = await runWithingsStartupReload(
      {
        withingsCredentials: credentials,
        withingsExpandedSyncEnabled: true,
        withingsSyncTimes: ['08:00', '20:00'],
        lastSuccessfulWithingsScheduledSlotKey: null,
        lastSuccessfulWithingsStartupSyncDate: null,
      },
      actions,
      new Date('2026-04-11T09:00:00'),
      true
    )

    expect(result).toMatchObject({ started: true, expandedSyncRan: false, latestKg: 70.25 })
    expect(syncWithingsWeightsAtStartupMock).toHaveBeenCalledTimes(1)
    expect(actions.setLastSuccessfulWithingsStartupSyncDate).toHaveBeenCalledWith('2026-04-11')
    expect(actions.setLastSuccessfulWithingsSyncAt).not.toHaveBeenCalled()
    expect(actions.setLastSuccessfulWithingsScheduledSlotKey).not.toHaveBeenCalled()
  })

  it('does not mark the startup day successful when weight refresh fails after expanded sync', async () => {
    const actions = makeActions()
    syncWithingsWeightsAtStartupMock.mockRejectedValueOnce(new Error('weight failed'))

    await expect(
      runWithingsStartupReload(
        {
          withingsCredentials: credentials,
          withingsExpandedSyncEnabled: true,
          withingsSyncTimes: ['08:00', '20:00'],
          lastSuccessfulWithingsScheduledSlotKey: null,
          lastSuccessfulWithingsStartupSyncDate: null,
        },
        actions,
        new Date('2026-04-11T09:00:00'),
        true
      )
    ).rejects.toThrow('weight failed')

    expect(syncWithingsDataMock).toHaveBeenCalledTimes(1)
    expect(actions.setLastSuccessfulWithingsScheduledSlotKey).toHaveBeenCalledWith('2026-04-11@08:00')
    expect(actions.setLastSuccessfulWithingsStartupSyncDate).not.toHaveBeenCalled()
  })
})
