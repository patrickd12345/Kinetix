/**
 * Withings OAuth2: getnonce + signed requesttoken.
 * Token endpoint: POST form-urlencoded to https://wbsapi.withings.net/v2/oauth2
 */
import crypto from 'node:crypto'

export const WITHINGS_API = 'https://wbsapi.withings.net'
const WITHINGS_RETRY_STATUSES = [502, 503, 504]
const WITHINGS_RETRY_DELAYS_MS = [1000, 2000, 4000]

/** Withings expects signature as hex. */
export function withingsHmac(key: string, message: string): string {
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex')
}

export async function withingsGetNonce(clientId: string, clientSecret: string): Promise<string> {
  for (let attempt = 0; attempt <= WITHINGS_RETRY_DELAYS_MS.length; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000)
    const toSign = ['getnonce', clientId, String(timestamp)].join(',')
    const signature = withingsHmac(clientSecret, toSign)
    const body = new URLSearchParams({
      action: 'getnonce',
      client_id: clientId,
      timestamp: String(timestamp),
      signature,
    })

    const res = await fetch(`${WITHINGS_API}/v2/signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = (await res.json().catch(() => ({}))) as {
      status?: number
      body?: { nonce?: string; error?: string }
      error?: string
    }

    if (!res.ok) {
      const msg = data.body?.error ?? data.error ?? `Withings getnonce: ${res.status}`
      throw new Error(String(msg))
    }

    if (data.status !== undefined && data.status !== 0) {
      const retryable = WITHINGS_RETRY_STATUSES.includes(data.status)
      if (retryable && attempt < WITHINGS_RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, WITHINGS_RETRY_DELAYS_MS[attempt]))
        continue
      }

      if (retryable) {
        throw new Error(
          'Withings returned an error (503/502/504). This can mean the service is busy or your credentials are invalid—check VITE_WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET in .env.local.'
        )
      }

      const msg = data.body?.error ?? `Withings getnonce failed (status ${data.status})`
      throw new Error(String(msg))
    }

    const nonce = data.body?.nonce
    if (!nonce) {
      const msg = data.body?.error ?? 'Withings getnonce: no nonce in response'
      throw new Error(String(msg))
    }
    return nonce
  }

  throw new Error(
    'Withings service is temporarily unavailable. Please try again in a few minutes.'
  )
}

export interface WithingsTokenParams {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface WithingsTokenResult {
  access_token: string
  refresh_token: string
  userid: number
  expires_in: number
}

export async function withingsRequestToken(
  clientId: string,
  clientSecret: string,
  bodyParams: Record<string, string>
): Promise<WithingsTokenResult> {
  const nonce = await withingsGetNonce(clientId, clientSecret)
  const signature = withingsHmac(clientSecret, ['requesttoken', clientId, nonce].join(','))
  const body = new URLSearchParams({ ...bodyParams, nonce, signature })

  const res = await fetch(`${WITHINGS_API}/v2/oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      body?: { error?: string }
      error?: string
    }
    const msg = errBody.body?.error ?? errBody.error ?? `Withings requesttoken: ${res.status}`
    throw new Error(String(msg))
  }

  const data = (await res.json()) as {
    status?: number
    error?: string
    body?: {
      access_token?: string
      refresh_token?: string
      userid?: number
      expires_in?: number
      error?: string
    }
  }

  if (data.status !== 0 || !data.body?.access_token) {
    const msg = data.body?.error ?? data.error ?? 'Withings token error'
    throw new Error(String(msg))
  }

  return {
    access_token: data.body.access_token,
    refresh_token: data.body.refresh_token ?? '',
    userid: data.body.userid ?? 0,
    expires_in: typeof data.body.expires_in === 'number' ? data.body.expires_in : 3 * 3600,
  }
}

export async function exchangeWithingsCode(
  params: WithingsTokenParams,
  code: string
): Promise<WithingsTokenResult> {
  const { clientId, clientSecret, redirectUri } = params
  return withingsRequestToken(clientId, clientSecret, {
    action: 'requesttoken',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  })
}

export async function refreshWithingsToken(
  params: Pick<WithingsTokenParams, 'clientId' | 'clientSecret'>,
  refreshToken: string
): Promise<WithingsTokenResult> {
  const { clientId, clientSecret } = params
  return withingsRequestToken(clientId, clientSecret, {
    action: 'requesttoken',
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}
