import { useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'

const WITHINGS_CLIENT_ID = import.meta.env.VITE_WITHINGS_CLIENT_ID ?? ''
const WITHINGS_REDIRECT_URI = `${typeof window !== 'undefined' ? window.location.origin : ''}/settings`
const WITHINGS_STATE = 'withings'

export function useWithingsAuth() {
  const { setWithingsCredentials, setWeightSource, setLastWithingsWeightKg } = useSettingsStore()

  const initiateOAuth = useCallback(() => {
    if (!WITHINGS_CLIENT_ID) {
      throw new Error('Withings client ID not configured (VITE_WITHINGS_CLIENT_ID)')
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: WITHINGS_CLIENT_ID,
      scope: 'user.metrics',
      redirect_uri: WITHINGS_REDIRECT_URI,
      state: WITHINGS_STATE,
    })
    window.location.href = `https://account.withings.com/oauth2_user/authorize2?${params.toString()}`
  }, [])

  const handleOAuthCallback = useCallback(
    async (code: string) => {
      const response = await fetch('/api/withings-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: WITHINGS_REDIRECT_URI }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to exchange Withings code')
      }
      const data = await response.json()
      const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3 * 3600
      setWithingsCredentials({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        userId: String(data.userid ?? ''),
        expiresAt: Date.now() + expiresIn * 1000,
      })
      setWeightSource('withings')
      window.history.replaceState({}, '', '/settings')
      return data
    },
    [setWithingsCredentials, setWeightSource]
  )

  const disconnect = useCallback(() => {
    setWithingsCredentials(null)
    setWeightSource('profile')
    setLastWithingsWeightKg(0)
  }, [setWithingsCredentials, setWeightSource, setLastWithingsWeightKg])

  return { initiateOAuth, handleOAuthCallback, disconnect }
}
