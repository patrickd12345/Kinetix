export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_at: number
  token_type?: string
}

export class GoogleAuthError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export async function exchangeGoogleCodeForToken(input: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams()
  params.append('code', input.code)
  params.append('client_id', input.clientId)
  params.append('client_secret', input.clientSecret)
  params.append('redirect_uri', input.redirectUri)
  params.append('grant_type', 'authorization_code')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string
      error_description?: string
    }
    const errorMessage = errorData.error_description || errorData.error || 'Failed to exchange Google code'
    throw new GoogleAuthError(response.status, errorMessage, errorData)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type?: string
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    token_type: data.token_type,
  }
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams()
  params.append('client_id', input.clientId)
  params.append('client_secret', input.clientSecret)
  params.append('refresh_token', input.refreshToken)
  params.append('grant_type', 'refresh_token')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string
      error_description?: string
    }
    const errorMessage = errorData.error_description || errorData.error || 'Google refresh failed'
    throw new GoogleAuthError(response.status, errorMessage, errorData)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type?: string
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || input.refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    token_type: data.token_type,
  }
}
