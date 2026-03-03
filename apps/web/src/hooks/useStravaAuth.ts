import { useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'

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
      // #region agent log
      const _logA = { redirectUri, origin: typeof window !== 'undefined' ? window.location.origin : '', codeLen: code?.length }
      console.log('[Strava OAuth Debug] Token exchange start', _logA)
      fetch('http://127.0.0.1:7929/ingest/f44e7bb9-8ee0-4b93-b48d-0966c77edead',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ad594'},body:JSON.stringify({sessionId:'7ad594',location:'useStravaAuth.ts:handleOAuthCallback',message:'Token exchange start',data:_logA,timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Brief delay to avoid Strava propagation delay (token exchange can fail if too fast)
      await new Promise((r) => setTimeout(r, 500))
      const response = await fetch('/api/strava-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // #region agent log
        console.log('[Strava OAuth Debug] Token exchange FAILED', { status: response.status, errorData })
        fetch('http://127.0.0.1:7929/ingest/f44e7bb9-8ee0-4b93-b48d-0966c77edead',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ad594'},body:JSON.stringify({sessionId:'7ad594',location:'useStravaAuth.ts:tokenExchangeFail',message:'Token exchange failed',data:{status:response.status,errorData},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        throw new Error((errorData as { error?: string }).error || 'Failed to exchange authorization code for token')
      }

      const data = (await response.json()) as { access_token: string; refresh_token: string; expires_at: number }
      // #region agent log
      console.log('[Strava OAuth Debug] Token exchange SUCCESS', { hasAccessToken: !!data?.access_token, hasRefreshToken: !!data?.refresh_token })
      fetch('http://127.0.0.1:7929/ingest/f44e7bb9-8ee0-4b93-b48d-0966c77edead',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ad594'},body:JSON.stringify({sessionId:'7ad594',location:'useStravaAuth.ts:tokenExchangeSuccess',message:'Token exchange success',data:{hasAccessToken:!!data?.access_token,hasRefreshToken:!!data?.refresh_token},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setStravaCredentials({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      })
      setStravaToken('')
      setStravaSyncError(null)
      window.history.replaceState({}, '', '/settings')
      return data.access_token
    } catch (error) {
      // #region agent log
      console.log('[Strava OAuth Debug] OAuth callback CATCH', { msg: error instanceof Error ? error.message : String(error) })
      fetch('http://127.0.0.1:7929/ingest/f44e7bb9-8ee0-4b93-b48d-0966c77edead',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ad594'},body:JSON.stringify({sessionId:'7ad594',location:'useStravaAuth.ts:catch',message:'OAuth callback catch',data:{msg:error instanceof Error?error.message:String(error)},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('OAuth callback error:', error)
      throw error
    }
  }, [setStravaCredentials, setStravaToken, setStravaSyncError])

  return { initiateOAuth, handleOAuthCallback }
}
