import { useSettingsStore } from '../store/settingsStore'

const REFRESH_BUFFER_SEC = 3600

/** Valid access token for Garmin partner APIs, or empty string. */
export async function getValidGarminConnectAccessToken(): Promise<string> {
  const { garminConnectCredentials, setGarminConnectCredentials, setGarminConnectError } =
    useSettingsStore.getState()
  if (!garminConnectCredentials) return ''

  const now = Math.floor(Date.now() / 1000)
  if (garminConnectCredentials.expiresAt > now + REFRESH_BUFFER_SEC) {
    return garminConnectCredentials.accessToken
  }

  try {
    const res = await fetch('/api/garmin-refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: garminConnectCredentials.refreshToken }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const message = (err as { error?: string }).error ?? 'Garmin token refresh failed'
      setGarminConnectError(message)
      setGarminConnectCredentials(null)
      return ''
    }
    const data = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_at: number
    }
    setGarminConnectCredentials({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      apiUserId: garminConnectCredentials.apiUserId,
    })
    setGarminConnectError(null)
    return data.access_token
  } catch (e) {
    console.warn('[Garmin Connect] refresh error:', e)
    setGarminConnectCredentials(null)
    return ''
  }
}
