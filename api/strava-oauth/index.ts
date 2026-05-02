import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { exchangeStravaCodeForToken, StravaAuthError } from '../_lib/stravaAuth.js'
import { sendApiError } from '../_lib/apiError.js'
import { logApiEvent } from '../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'
import { requireSupabaseUser, upsertProviderToken } from '../_lib/providerTokenVault.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type'],
  })

  if (!cors.allowed) {
    return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
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
  let user: { id: string }
  try {
    user = await requireSupabaseUser(req, runtime)
  } catch {
    return sendApiError(res, 401, 'Authentication required', { source: req.headers })
  }
  const clientSecret = runtime.stravaClientSecret
  const clientId = runtime.stravaClientId

  if (!clientSecret) {
    logApiEvent('error', 'kinetix_strava_oauth_missing_config', {
      message: 'STRAVA_CLIENT_SECRET not configured',
    })
    return sendApiError(res, 500, 'Server configuration error: STRAVA_CLIENT_SECRET not set', {
      source: req.headers,
    })
  }

  try {
    const data = await exchangeStravaCodeForToken({
      code,
      clientId,
      clientSecret,
      redirectUri: redirect_uri || `${req.headers.origin}/settings`,
    })

    const expiresAt = data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null
    const connection = await upsertProviderToken(runtime, {
      userId: user.id,
      provider: 'strava',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scopes: ['activity:read_all'],
    })
    res.status(200).json(connection)
  } catch (error) {
    if (error instanceof StravaAuthError) {
      logApiEvent('error', 'kinetix_strava_oauth_exchange_failed', {
        message: error.message,
        details: error.details ?? null,
      })
      return sendApiError(res, error.status, error.message, {
        source: req.headers,
        details: error.details ? String(error.details) : undefined,
      })
    }
    logApiEvent('error', 'kinetix_strava_oauth_exchange_failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return sendApiError(res, 500, 'Failed to exchange authorization code', {
      source: req.headers,
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
