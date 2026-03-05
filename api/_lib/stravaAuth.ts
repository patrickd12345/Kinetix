export interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

export class StravaAuthError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function parseStravaErrorMessage(errorData: {
  message?: string
  errors?: Array<{ field?: string; code?: string }>
}): string | null {
  if (errorData?.message) return errorData.message
  if (Array.isArray(errorData?.errors) && errorData.errors[0]?.code) {
    return errorData.errors.map((e) => e.code).join(', ')
  }
  return null
}

export async function exchangeStravaCodeForToken(input: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<StravaTokenResponse> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    }),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string
      errors?: Array<{ field?: string; code?: string }>
    }
    const errorMessage = parseStravaErrorMessage(errorData) || 'Failed to exchange authorization code'
    throw new StravaAuthError(response.status, errorMessage, errorData)
  }

  const data = (await response.json()) as StravaTokenResponse
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  }
}

export async function refreshStravaAccessToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<StravaTokenResponse> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
    }),
  })

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as { message?: string }
    const errorMessage = errData.message ?? 'Strava refresh failed'
    throw new StravaAuthError(response.status, errorMessage, errData)
  }

  const data = (await response.json()) as StravaTokenResponse
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  }
}
