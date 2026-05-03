import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { exchangeGoogleCodeForToken, GoogleAuthError } from '../_lib/googleAuth.js'
import { sendApiError } from '../_lib/apiError.js'
import { logApiEvent } from '../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Content-Type'],
  })

  if (!cors.allowed) {
    return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Handle GET from Google redirect
  if (req.method === 'GET') {
    const { code, error } = req.query
    if (error) {
      return res.redirect(`kinetix://oauth/google/callback?error=${error}`)
    }
    if (!code) {
      return res.status(400).send('Authorization code missing')
    }
    // Redirect back to the iOS app using custom scheme
    return res.redirect(`kinetix://oauth/google/callback?code=${code}`)
  }

  if (req.method !== 'POST') {
    return sendApiError(res, 405, 'Method not allowed', { source: req.headers })
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as { code?: string; redirect_uri?: string }
  const { code, redirect_uri } = body

  if (!code) {
    return sendApiError(res, 400, 'Authorization code required', { source: req.headers })
  }

  const runtime = resolveKinetixRuntimeEnv()
  const clientSecret = runtime.googleClientSecret
  const clientId = runtime.googleClientId

  if (!clientSecret) {
    logApiEvent('error', 'kinetix_google_oauth_missing_config', {
      message: 'GOOGLE_CLIENT_SECRET not configured',
    })
    return sendApiError(res, 500, 'Server configuration error: GOOGLE_CLIENT_SECRET not set', {
      source: req.headers,
    })
  }

  try {
    const data = await exchangeGoogleCodeForToken({
      code,
      clientId,
      clientSecret,
      // The redirect_uri must match what was sent to Google (the proxy endpoint itself)
      redirectUri: redirect_uri || `${req.headers.origin}/api/google-oauth`,
    })

    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      token_type: data.token_type,
    })
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      logApiEvent('error', 'kinetix_google_oauth_exchange_failed', {
        message: error.message,
        details: error.details ?? null,
      })
      return sendApiError(res, error.status, error.message, {
        source: req.headers,
        details: error.details ? String(error.details) : undefined,
      })
    }
    logApiEvent('error', 'kinetix_google_oauth_exchange_failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return sendApiError(res, 500, 'Failed to exchange authorization code', {
      source: req.headers,
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
