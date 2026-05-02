import type { WithingsAuthCredentials } from './types'
import { getSessionAuthHeaders } from '../../apiAuth'

export async function refreshWithingsConnection(): Promise<WithingsAuthCredentials> {
  const res = await fetch('/api/withings-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getSessionAuthHeaders()) },
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to refresh Withings token')
  }

  const data = await res.json()
  return {
    userId: String(data.provider_user_id ?? ''),
    expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : 0,
  }
}

export async function ensureValidWithingsAccess(creds: WithingsAuthCredentials): Promise<WithingsAuthCredentials> {
  const bufferMs = 5 * 60 * 1000
  if (Date.now() < creds.expiresAt - bufferMs) return creds
  return refreshWithingsConnection()
}
