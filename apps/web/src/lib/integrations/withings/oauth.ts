import type { WithingsAuthCredentials } from './types'

export async function refreshWithingsToken(refreshToken: string): Promise<WithingsAuthCredentials> {
  const res = await fetch('/api/withings-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to refresh Withings token')
  }

  const data = await res.json()
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3 * 3600
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: String(data.userid ?? data.user_id ?? ''),
    expiresAt: Date.now() + expiresIn * 1000,
  }
}

export async function ensureValidWithingsAccess(creds: WithingsAuthCredentials): Promise<WithingsAuthCredentials> {
  const bufferMs = 5 * 60 * 1000
  if (Date.now() < creds.expiresAt - bufferMs) return creds
  return refreshWithingsToken(creds.refreshToken)
}
