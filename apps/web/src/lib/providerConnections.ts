import type { StravaCredentials, WithingsCredentials } from '../store/settingsStore'
import { getSessionAuthHeaders } from './apiAuth'

export interface ProviderConnection {
  provider: 'strava' | 'withings'
  connected: boolean
  provider_user_id?: string
  expires_at?: string
}

function expiresAtMs(value?: string): number {
  return value ? new Date(value).getTime() : 0
}

export function toStravaConnection(connection: ProviderConnection): StravaCredentials {
  return { expiresAt: Math.floor(expiresAtMs(connection.expires_at) / 1000) }
}

export function toWithingsConnection(connection: ProviderConnection): WithingsCredentials {
  return {
    userId: connection.provider_user_id ?? '',
    expiresAt: expiresAtMs(connection.expires_at),
  }
}

export async function fetchProviderConnections(): Promise<ProviderConnection[]> {
  const res = await fetch('/api/provider-connections', {
    headers: { ...(await getSessionAuthHeaders()) },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { connections?: ProviderConnection[] }
  return data.connections ?? []
}

export async function disconnectProvider(provider: ProviderConnection['provider']): Promise<void> {
  await fetch(`/api/provider-connections?provider=${provider}`, {
    method: 'DELETE',
    headers: { ...(await getSessionAuthHeaders()) },
  })
}

