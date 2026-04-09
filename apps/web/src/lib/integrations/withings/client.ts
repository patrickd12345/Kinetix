import type { WithingsApiEnvelope, WithingsAuthCredentials } from './types'
import { ensureValidWithingsAccess } from './oauth'

const BASE_URL = 'https://wbsapi.withings.net'

export async function withingsPost<TBody>(
  credentials: WithingsAuthCredentials,
  path: string,
  body: URLSearchParams
): Promise<WithingsApiEnvelope<TBody>> {
  const valid = await ensureValidWithingsAccess(credentials)
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${valid.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    return { status: res.status, body: { error: await res.text() } as TBody & { error?: string } }
  }

  return (await res.json()) as WithingsApiEnvelope<TBody>
}
