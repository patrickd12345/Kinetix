/**
 * Garmin Connect Developer Program — OAuth 2.0 with PKCE (server-side token exchange & refresh).
 * Spec: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf
 */

export interface GarminTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

export class GarminAuthError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString()
}

async function parseGarminTokenError(res: Response): Promise<{ message: string; raw: unknown }> {
  const raw = await res.json().catch(() => ({}))
  const o = raw as { error?: string; error_description?: string; message?: string }
  const message =
    o.error_description || o.message || o.error || `Garmin token error (${res.status})`
  return { message, raw }
}

export async function exchangeGarminAuthorizationCode(input: {
  code: string
  codeVerifier: string
  clientId: string
  clientSecret: string
  redirectUri?: string
}): Promise<GarminTokenResponse> {
  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    code_verifier: input.codeVerifier,
  }
  if (input.redirectUri) {
    params.redirect_uri = input.redirectUri
  }

  const res = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody(params),
  })

  if (!res.ok) {
    const { message, raw } = await parseGarminTokenError(res)
    throw new GarminAuthError(res.status, message, raw)
  }

  return (await res.json()) as GarminTokenResponse
}

export async function refreshGarminAccessToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<GarminTokenResponse> {
  const res = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      grant_type: 'refresh_token',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
    }),
  })

  if (!res.ok) {
    const { message, raw } = await parseGarminTokenError(res)
    throw new GarminAuthError(res.status, message, raw)
  }

  return (await res.json()) as GarminTokenResponse
}

/** Partner API user id (stable for the Connect account across reconnects). */
export async function fetchGarminPartnerUserId(accessToken: string): Promise<string | null> {
  const res = await fetch('https://apis.garmin.com/wellness-api/rest/user/id', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { userId?: string }
  return typeof data.userId === 'string' ? data.userId : null
}

/** Unix seconds when access token should be treated as expired (Garmin recommends refreshing early). */
export function garminAccessTokenExpiresAtSeconds(expiresIn: number, safetySeconds = 600): number {
  const now = Math.floor(Date.now() / 1000)
  const ttl = Math.max(60, Math.floor(expiresIn) - safetySeconds)
  return now + ttl
}
