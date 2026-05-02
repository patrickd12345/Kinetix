import { useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { getSessionAuthHeaders } from '../lib/apiAuth'

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || '157217'

function getStravaRedirectUri(): string {
  // Production: use fixed redirect so Strava callback lands on deployed domain
  const envUri = import.meta.env.VITE_STRAVA_REDIRECT_URI
  if (envUri && typeof envUri === 'string' && envUri.startsWith('http')) {
    return envUri.replace(/\/$/, '')
  }
  if (typeof window === 'undefined') return '/settings'
  return `${window.location.origin}/settings`
}

export function useStravaAuth() {
  const { setStravaCredentials, setStravaToken, setStravaSyncError } = useSettingsStore()

  const initiateOAuth = useCallback(() => {
    const redirectUri = getStravaRedirectUri()
    const params = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      approval_prompt: 'force',
      scope: 'activity:read_all',
    })

    window.location.href = `https://www.strava.com/oauth/authorize?${params.toString()}`
  }, [])

  const handleOAuthCallback = useCallback(async (code: string) => {
    try {
      const redirectUri = getStravaRedirectUri()
      // Brief delay to avoid Strava propagation delay (token exchange can fail if too fast)
      await new Promise((r) => setTimeout(r, 500))
      const response = await fetch('/api/strava-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSessionAuthHeaders()) },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error((errorData as { error?: string }).error || 'Failed to exchange authorization code for token')
      }

      const data = (await response.json()) as { expires_at?: string }
      setStravaCredentials({
        expiresAt: data.expires_at ? Math.floor(new Date(data.expires_at).getTime() / 1000) : 0,
      })
      setStravaToken('')
      setStravaSyncError(null)
      window.history.replaceState({}, '', '/settings')
      return true
    } catch (error) {
      console.error('OAuth callback error:', error)
      throw error
    }
  }, [setStravaCredentials, setStravaToken, setStravaSyncError])

  return { initiateOAuth, handleOAuthCallback }
}
