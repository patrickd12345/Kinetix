import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WithingsSyncPrompt from './WithingsSyncPrompt'
import { useSettingsStore } from '../store/settingsStore'

const syncWithingsDataMock = vi.fn()
const evaluateWithingsSyncPolicyMock = vi.fn()
const useWithingsSyncPromptMock = vi.fn()

vi.mock('../lib/integrations/withings/sync', () => ({
  syncWithingsData: (...args: unknown[]) => syncWithingsDataMock(...args),
}))

vi.mock('../hooks/useWithingsSyncPrompt', () => ({
  useWithingsSyncPrompt: () => useWithingsSyncPromptMock(),
}))

vi.mock('../lib/integrations/withings/syncPolicy', () => ({
  normalizeSyncTimes: (times: [string, string]) => times,
  evaluateWithingsSyncPolicy: (...args: unknown[]) => evaluateWithingsSyncPolicyMock(...args),
}))

describe('WithingsSyncPrompt', () => {
  beforeEach(() => {
    syncWithingsDataMock.mockReset()
    evaluateWithingsSyncPolicyMock.mockReset()
    useWithingsSyncPromptMock.mockReset()
    useWithingsSyncPromptMock.mockReturnValue({
      isDue: true,
      reason: 'scheduled_due',
      scheduledTime: '08:00',
      scheduledSlotKey: '2026-04-09@08:00',
      nextEligibleAt: undefined,
      connectionExists: true,
      expandedEnabled: true,
      startupInFlight: false,
    })
    evaluateWithingsSyncPolicyMock.mockReturnValue({
      shouldSync: true,
      reason: 'scheduled_due',
      scheduledSlotKey: '2026-04-09@08:00',
    })

    useSettingsStore.setState({
      withingsExpandedSyncEnabled: true,
      withingsSyncTimes: ['08:00', '20:00'],
      withingsCredentials: {
        accessToken: 'a',
        refreshToken: 'r',
        userId: 'u1',
        expiresAt: Date.now() + 1000,
      },
      lastSuccessfulWithingsScheduledSlotKey: null,
      lastSuccessfulWithingsSyncAt: '2026-04-09T07:00:00.000Z',
    })
  })

  it('banner appears when due', () => {
    render(<WithingsSyncPrompt />)
    expect(screen.getByText('Withings sync due')).toBeInTheDocument()
  })

  it('banner hidden when not due', () => {
    useWithingsSyncPromptMock.mockReturnValueOnce({
      isDue: false,
      reason: 'not_due',
      connectionExists: true,
      expandedEnabled: true,
      startupInFlight: false,
    })
    render(<WithingsSyncPrompt />)
    expect(screen.queryByText('Withings sync due')).not.toBeInTheDocument()
  })

  it('banner hidden while startup sync is already in flight', () => {
    useWithingsSyncPromptMock.mockReturnValueOnce({
      isDue: true,
      reason: 'scheduled_due',
      connectionExists: true,
      expandedEnabled: true,
      startupInFlight: true,
    })
    render(<WithingsSyncPrompt />)
    expect(screen.queryByText('Withings sync due')).not.toBeInTheDocument()
  })

  it('dismiss hides banner', () => {
    render(<WithingsSyncPrompt />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText('Withings sync due')).not.toBeInTheDocument()
  })

  it('clicking sync triggers run once and blocks duplicate clicks', async () => {
    let resolveSync: ((value: { metricsWritten: number }) => void) | null = null
    syncWithingsDataMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve
        })
    )

    render(<WithingsSyncPrompt />)
    const button = screen.getByRole('button', { name: 'Sync now' })

    fireEvent.click(button)
    fireEvent.click(button)

    expect(syncWithingsDataMock).toHaveBeenCalledTimes(1)

    resolveSync?.({ metricsWritten: 12 })

    await waitFor(() => {
      expect(screen.getByText(/Sync complete/i)).toBeInTheDocument()
    })
  })

  it('failure updates UI', async () => {
    syncWithingsDataMock.mockRejectedValueOnce(new Error('boom'))

    render(<WithingsSyncPrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))

    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument()
    })
  })

  it('due slot marked fulfilled after successful due sync', async () => {
    syncWithingsDataMock.mockResolvedValueOnce({ metricsWritten: 7 })
    evaluateWithingsSyncPolicyMock
      .mockReturnValueOnce({ shouldSync: true, reason: 'scheduled_due', scheduledSlotKey: '2026-04-09@08:00' })
      .mockReturnValueOnce({ shouldSync: true, reason: 'scheduled_due', scheduledSlotKey: '2026-04-09@08:00' })

    render(<WithingsSyncPrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))

    await waitFor(() => {
      expect(useSettingsStore.getState().lastSuccessfulWithingsScheduledSlotKey).toBe('2026-04-09@08:00')
    })
  })

  it('manual sync outside due slot does not fulfill slot', async () => {
    syncWithingsDataMock.mockResolvedValueOnce({ metricsWritten: 2 })
    evaluateWithingsSyncPolicyMock
      .mockReturnValueOnce({ shouldSync: false, reason: 'not_due', scheduledSlotKey: undefined })
      .mockReturnValueOnce({ shouldSync: false, reason: 'not_due', scheduledSlotKey: undefined })

    render(<WithingsSyncPrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))

    await waitFor(() => {
      expect(syncWithingsDataMock).toHaveBeenCalledTimes(1)
    })
    expect(useSettingsStore.getState().lastSuccessfulWithingsScheduledSlotKey).toBeNull()
  })
})
