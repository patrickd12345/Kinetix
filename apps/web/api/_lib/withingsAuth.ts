/**
 * Withings OAuth2: getnonce + signed requesttoken.
 * Token endpoint: POST form-urlencoded to https://wbsapi.withings.net/v2/oauth2
 */
import crypto from 'node:crypto'

const WITHINGS_API = 'https://wbsapi.withings.net'

function hmacSha256Base64(key: string, message: string): string {
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('base64')
}

async function getNonce(clientId: string, clientSecret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const toSign = ['getnonce', clientId, String(timestamp)].join(',')
  const signature = hmacSha256Base64(clientSecret, toSign)
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
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Withings getnonce failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  const nonce = data?.body?.nonce
  if (!nonce) throw new Error('Withings getnonce: no nonce in response')
  return nonce
}

function signRequestToken(clientSecret: string, clientId: string, nonce: string): string {
  const toSign = ['requesttoken', clientId, nonce].join(',')
  return hmacSha256Base64(clientSecret, toSign)
}

export interface WithingsTokenParams {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export async function exchangeWithingsCode(
  params: WithingsTokenParams,
  code: string
): Promise<{ access_token: string; refresh_token: string; userid: number; expires_in: number }> {
  const { clientId, clientSecret, redirectUri } = params
  const nonce = await getNonce(clientId, clientSecret)
  const signature = signRequestToken(clientSecret, clientId, nonce)
  const body = new URLSearchParams({
    action: 'requesttoken',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
    nonce,
    signature,
  })

  const res = await fetch(`${WITHINGS_API}/v2/oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Withings requesttoken failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  const status = data?.status
  const bodyData = data?.body
  if (status !== 0 || !bodyData?.access_token) {
    const errMsg = bodyData?.error ?? data?.error ?? 'Unknown Withings error'
    throw new Error(String(errMsg))
  }
  return {
    access_token: bodyData.access_token,
    refresh_token: bodyData.refresh_token,
    userid: bodyData.userid ?? 0,
    expires_in: typeof bodyData.expires_in === 'number' ? bodyData.expires_in : 3 * 3600,
  }
}

export async function refreshWithingsToken(
  params: Pick<WithingsTokenParams, 'clientId' | 'clientSecret'>,
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; userid: number; expires_in: number }> {
  const { clientId, clientSecret } = params
  const nonce = await getNonce(clientId, clientSecret)
  const signature = signRequestToken(clientSecret, clientId, nonce)
  const body = new URLSearchParams({
    action: 'requesttoken',
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    nonce,
    signature,
  })

  const res = await fetch(`${WITHINGS_API}/v2/oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Withings refresh failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  const status = data?.status
  const bodyData = data?.body
  if (status !== 0 || !bodyData?.access_token) {
    const errMsg = bodyData?.error ?? data?.error ?? 'Unknown Withings error'
    throw new Error(String(errMsg))
  }
  return {
    access_token: bodyData.access_token,
    refresh_token: bodyData.refresh_token,
    userid: bodyData.userid ?? 0,
    expires_in: typeof bodyData.expires_in === 'number' ? bodyData.expires_in : 3 * 3600,
  }
}
