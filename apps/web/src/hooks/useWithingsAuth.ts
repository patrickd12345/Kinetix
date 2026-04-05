import { useCallback } from 'react'
import {
  KINETIX_WITHINGS_REDIRECT_STORAGE_KEY,
  normalizeWithingsRedirectUri,
  resolveWithingsRedirectUriForOAuth,
} from '../../../../api/_lib/withingsRedirectUri'
import { useSettingsStore } from '../store/settingsStore'

const WITHINGS_CLIENT_ID = import.meta.env.VITE_WITHINGS_CLIENT_ID ?? ''
const WITHINGS_STATE = 'withings'

function getWithingsRedirectUri(): string {
  return resolveWithingsRedirectUriForOAuth({
    explicit: import.meta.env.VITE_WITHINGS_REDIRECT_URI,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  })
}

/**
 * Same string as authorize `redirect_uri` — prefer sessionStorage so token exchange cannot drift
 * (www vs apex, env vs origin, or rebuild mismatch).
 */
function getRedirectUriForTokenExchange(): string {
  if (typeof sessionStorage !== 'undefined') {
    const stored = sessionStorage.getItem(KINETIX_WITHINGS_REDIRECT_STORAGE_KEY)
    if (stored?.trim()) {
      return normalizeWithingsRedirectUri(stored)
    }
  }
  return getWithingsRedirectUri()
}

export function useWithingsAuth() {
  const { setWithingsCredentials, setWeightSource, setLastWithingsWeightKg } = useSettingsStore()

  const initiateOAuth = useCallback(() => {
    if (!WITHINGS_CLIENT_ID) {
      throw new Error('Withings client ID not configured (VITE_WITHINGS_CLIENT_ID)')
    }
    const redirectUri = getWithingsRedirectUri()
    if (!redirectUri) {
      throw new Error('Withings redirect URI could not be resolved (set VITE_WITHINGS_REDIRECT_URI or use HTTPS origin)')
    }
    try {
      sessionStorage.setItem(KINETIX_WITHINGS_REDIRECT_STORAGE_KEY, redirectUri)
    } catch {
      /* private mode / quota */
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: WITHINGS_CLIENT_ID,
      scope: 'user.metrics',
      redirect_uri: redirectUri,
      state: WITHINGS_STATE,
    })
    window.location.href = `https://account.withings.com/oauth2_user/authorize2?${params.toString()}`
  }, [])

  const handleOAuthCallback = useCallback(
    async (code: string) => {
      const redirectUri = getRedirectUriForTokenExchange()
      try {
        sessionStorage.removeItem(KINETIX_WITHINGS_REDIRECT_STORAGE_KEY)
      } catch {
        /* ignore */
      }
      const response = await fetch('/api/withings-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      })
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string
          details?: string
        }
        const msg = [err.error, err.details].filter(Boolean).join(' — ')
        throw new Error(msg || 'Failed to exchange Withings code')
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
