import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // #region agent log
  console.log('[OAuth] Request received:', { method: req.method, hasCode: !!req.body?.code, hasRedirectUri: !!req.body?.redirect_uri })
  // #endregion
  
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

  const { code, redirect_uri } = req.body

  if (!code) {
    // #region agent log
    console.error('[OAuth] Missing authorization code')
    // #endregion
    return res.status(400).json({ error: 'Authorization code required' })
  }

  // Get client secret from environment variable
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  const clientId = process.env.STRAVA_CLIENT_ID || '157217'

  // #region agent log
  console.log('[OAuth] Configuration:', { 
    hasClientSecret: !!clientSecret, 
    clientId, 
    codeLength: code?.length || 0,
    redirectUri: redirect_uri || req.headers.origin + '/settings'
  })
  // #endregion

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

    // #region agent log
    console.log('[OAuth] Exchanging token:', { url: tokenExchangeUrl, hasCode: !!code, redirectUri: tokenExchangeBody.redirect_uri })
    // #endregion

    // Exchange authorization code for access token
    const response = await fetch(tokenExchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenExchangeBody),
    })

    // #region agent log
    console.log('[OAuth] Strava response:', { status: response.status, statusText: response.statusText, ok: response.ok })
    // #endregion

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[OAuth] Strava token exchange error:', errorData)
      return res.status(response.status).json({
        error: 'Failed to exchange authorization code',
        details: errorData,
      })
    }

    const data = await response.json()
    
    // #region agent log
    console.log('[OAuth] Token exchange success:', { hasAccessToken: !!data.access_token, hasRefreshToken: !!data.refresh_token })
    // #endregion
    
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
