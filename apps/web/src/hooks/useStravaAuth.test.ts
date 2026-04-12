import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { useStravaAuth } from './useStravaAuth'
import { useSettingsStore } from '../store/settingsStore'

const originalLocation = window.location

describe('useStravaAuth', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    // Reset global store state
    useSettingsStore.setState({
      stravaCredentials: null,
      stravaToken: 'old_token',
      stravaSyncError: 'old_error',
    })

    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: 'http://localhost:5173/settings', origin: 'http://localhost:5173' },
    })

    // Mock window.history.replaceState
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})

    // Mock fetch
    global.fetch = vi.fn()

    // Mock console.error to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  describe('initiateOAuth', () => {
    it('sets window.location.href to the correct Strava authorization URL', () => {
      const { result } = renderHook(() => useStravaAuth())

      act(() => {
        result.current.initiateOAuth()
      })

      expect(window.location.href).toContain('https://www.strava.com/oauth/authorize')
      expect(window.location.href).toContain('client_id=157217')
      expect(window.location.href).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fsettings')
      expect(window.location.href).toContain('response_type=code')
      expect(window.location.href).toContain('approval_prompt=force')
      expect(window.location.href).toContain('scope=activity%3Aread_all')
    })
  })

  describe('handleOAuthCallback', () => {
    it('handles success path correctly', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_at: 1234567890,
        }),
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useStravaAuth())

      let promise: Promise<string> | undefined
      act(() => {
        promise = result.current.handleOAuthCallback('mock_code')
      })

      // Advance timers by 500ms for the artificial delay
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      const accessToken = await promise

      expect(accessToken).toBe('mock_access_token')
      expect(global.fetch).toHaveBeenCalledWith('/api/strava-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'mock_code', redirect_uri: 'http://localhost:5173/settings' }),
      })

      const storeState = useSettingsStore.getState()
      expect(storeState.stravaCredentials).toEqual({
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresAt: 1234567890,
      })
      expect(storeState.stravaToken).toBe('')
      expect(storeState.stravaSyncError).toBeNull()
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/settings')
    })

    it('throws error when fetch resolves with response.ok = false (HTTP error with JSON body)', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Invalid authorization code' }),
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useStravaAuth())

      let promise: Promise<string>

      act(() => {
        promise = result.current.handleOAuthCallback('mock_code')
      })

      // Need to await the rejection properly to avoid unhandled rejection warnings
      await act(async () => {
        vi.advanceTimersByTime(500)
        await expect(promise).rejects.toThrow('Invalid authorization code')
      })

      // Store state shouldn't have changed to successful values
      const storeState = useSettingsStore.getState()
      expect(storeState.stravaCredentials).toBeNull()
    })

    it('throws default error when fetch resolves with response.ok = false and no valid JSON body', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('SyntaxError: Unexpected end of JSON input')),
      }
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useStravaAuth())

      let promise: Promise<string>

      act(() => {
        promise = result.current.handleOAuthCallback('mock_code')
      })

      await act(async () => {
        vi.advanceTimersByTime(500)
        await expect(promise).rejects.toThrow('Failed to exchange authorization code for token')
      })
    })

    it('throws error when fetch rejects/throws (network failure scenario)', async () => {
      const networkError = new Error('Network failure')
      ;(global.fetch as any).mockRejectedValue(networkError)

      const { result } = renderHook(() => useStravaAuth())

      let promise: Promise<string>

      act(() => {
        promise = result.current.handleOAuthCallback('mock_code')
      })

      await act(async () => {
        vi.advanceTimersByTime(500)
        await expect(promise).rejects.toThrow(networkError)
      })
    })
  })
})
