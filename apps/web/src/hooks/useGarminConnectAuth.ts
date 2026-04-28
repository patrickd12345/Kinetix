import { useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { createGarminPkcePair, garminPkceVerifierStorageKey } from '../lib/garminConnectPkce'

const GARMIN_OAUTH_STATE = 'garmin_connect'
const CLIENT_ID = import.meta.env.VITE_GARMIN_CONNECT_CLIENT_ID ?? ''

function getGarminRedirectUri(): string {
  const envUri = import.meta.env.VITE_GARMIN_CONNECT_REDIRECT_URI
  if (envUri && typeof envUri === 'string' && envUri.startsWith('http')) {
    return envUri.replace(/\/$/, '')
  }
  if (typeof window === 'undefined') return '/settings'
  return `${window.location.origin}/settings`
}

export function useGarminConnectAuth() {
  const { setGarminConnectCredentials, setGarminConnectError } = useSettingsStore()

  const initiateOAuth = useCallback(
    async (authUserId: string) => {
      if (!CLIENT_ID) {
        throw new Error('VITE_GARMIN_CONNECT_CLIENT_ID is not configured')
      }
      const { verifier, challenge } = await createGarminPkcePair()
      try {
        sessionStorage.setItem(garminPkceVerifierStorageKey(authUserId), verifier)
      } catch {
        throw new Error('Could not store PKCE verifier (session storage unavailable)')
      }
      const redirectUri = getGarminRedirectUri()
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        redirect_uri: redirectUri,
        state: GARMIN_OAUTH_STATE,
      })
      window.location.href = `https://connect.garmin.com/oauth2Confirm?${params.toString()}`
    },
    []
  )

  const handleOAuthCallback = useCallback(
    async (code: string, authUserId: string) => {
      const verifier = sessionStorage.getItem(garminPkceVerifierStorageKey(authUserId))
      if (!verifier) {
        throw new Error('Missing PKCE verifier. Use Connect Garmin from Settings again.')
      }
      try {
        sessionStorage.removeItem(garminPkceVerifierStorageKey(authUserId))
      } catch {
        /* ignore */
      }
      const redirectUri = getGarminRedirectUri()
      const response = await fetch('/api/garmin-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        const msg = [err.error, err.details].filter(Boolean).join(' — ')
        throw new Error(msg || 'Garmin token exchange failed')
      }
      const data = (await response.json()) as {
        access_token: string
        refresh_token: string
        expires_at: number
        garmin_api_user_id?: string | null
      }
      setGarminConnectCredentials({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        apiUserId: data.garmin_api_user_id ?? undefined,
      })
      setGarminConnectError(null)
      window.history.replaceState({}, '', '/settings')
    },
    [setGarminConnectCredentials, setGarminConnectError]
  )

  return {
    initiateOAuth,
    handleOAuthCallback,
    isGarminConnectClientConfigured: Boolean(CLIENT_ID),
    garminOAuthState: GARMIN_OAUTH_STATE,
  }
}
