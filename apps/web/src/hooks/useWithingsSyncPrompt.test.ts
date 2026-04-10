import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWithingsSyncPrompt } from './useWithingsSyncPrompt'
import { useSettingsStore } from '../store/settingsStore'

describe('useWithingsSyncPrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSettingsStore.setState({
      withingsExpandedSyncEnabled: true,
      withingsCredentials: {
        accessToken: 'a',
        refreshToken: 'r',
        userId: 'u1',
        expiresAt: Date.now() + 100000,
      },
      withingsSyncTimes: ['08:00', '20:00'],
      lastSuccessfulWithingsScheduledSlotKey: null,
    })
    vi.stubEnv('VITE_ENABLE_WITHINGS_EXPANDED_INGESTION', 'true')
  })

  it('detects due at 08:00', () => {
    vi.setSystemTime(new Date('2026-04-09T08:00:00'))
    const { result } = renderHook(() => useWithingsSyncPrompt())
    expect(result.current.isDue).toBe(true)
    expect(result.current.scheduledSlotKey).toBe('2026-04-09@08:00')
  })

  it('detects due at 20:00', () => {
    vi.setSystemTime(new Date('2026-04-09T20:00:00'))
    useSettingsStore.setState({ lastSuccessfulWithingsScheduledSlotKey: '2026-04-09@08:00' })
    const { result } = renderHook(() => useWithingsSyncPrompt())
    expect(result.current.isDue).toBe(true)
    expect(result.current.scheduledSlotKey).toBe('2026-04-09@20:00')
  })

  it('is not due before 08:00', () => {
    vi.setSystemTime(new Date('2026-04-09T07:59:00'))
    const { result } = renderHook(() => useWithingsSyncPrompt())
    expect(result.current.isDue).toBe(false)
    expect(result.current.reason).toBe('not_due')
  })

  it('is not due after fulfilled slot', () => {
    vi.setSystemTime(new Date('2026-04-09T08:30:00'))
    useSettingsStore.setState({ lastSuccessfulWithingsScheduledSlotKey: '2026-04-09@08:00' })
    const { result } = renderHook(() => useWithingsSyncPrompt())
    expect(result.current.isDue).toBe(false)
    expect(result.current.reason).toBe('not_due')
  })

  it('re-checks on focus', () => {
    vi.setSystemTime(new Date('2026-04-09T07:59:00'))
    const { result } = renderHook(() => useWithingsSyncPrompt())
    expect(result.current.isDue).toBe(false)

    vi.setSystemTime(new Date('2026-04-09T08:01:00'))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current.isDue).toBe(true)
  })
})
