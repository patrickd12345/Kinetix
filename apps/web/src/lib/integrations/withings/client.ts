import type { WithingsApiEnvelope, WithingsAuthCredentials } from './types'
import { ensureValidWithingsAccess } from './oauth'
import { getSessionAuthHeaders } from '../../apiAuth'

export async function withingsPost<TBody>(
  credentials: WithingsAuthCredentials,
  path: string,
  body: URLSearchParams
): Promise<WithingsApiEnvelope<TBody>> {
  await ensureValidWithingsAccess(credentials)
  const res = await fetch('/api/withings-provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getSessionAuthHeaders()) },
    body: JSON.stringify({ path, body: body.toString() }),
  })

  if (!res.ok) {
    return { status: res.status, body: { error: await res.text() } as TBody & { error?: string } }
  }

  return (await res.json()) as WithingsApiEnvelope<TBody>
}
