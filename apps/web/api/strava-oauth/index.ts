import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as { code?: string; redirect_uri?: string }
  const { code, redirect_uri } = body

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' })
  }

  // Get client secret from environment variable
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  const clientId = process.env.STRAVA_CLIENT_ID || '157217'

  if (!clientSecret) {
    console.error('[OAuth] STRAVA_CLIENT_SECRET not configured')
    return res.status(500).json({ error: 'Server configuration error: STRAVA_CLIENT_SECRET not set' })
  }

  try {
    const tokenExchangeUrl = 'https://www.strava.com/oauth/token'
    const tokenExchangeBody = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirect_uri || `${req.headers.origin}/settings`,
    }

    // Exchange authorization code for access token
    const response = await fetch(tokenExchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenExchangeBody),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string; errors?: Array<{ field?: string; code?: string }> }
      console.error('[OAuth] Strava token exchange error:', errorData)
      const stravaMsg = errorData?.message ?? (Array.isArray(errorData?.errors) && errorData.errors[0]?.code ? errorData.errors.map((e) => e.code).join(', ') : null)
      return res.status(response.status).json({
        error: stravaMsg || 'Failed to exchange authorization code',
        details: errorData,
      })
    }

    const data = await response.json()

    // Return access token and refresh token
    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    })
  } catch (error) {
    console.error('[OAuth] Token exchange error:', error)
    res.status(500).json({
      error: 'Failed to exchange authorization code',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
