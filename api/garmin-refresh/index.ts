import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import {
  garminAccessTokenExpiresAtSeconds,
  GarminAuthError,
  refreshGarminAccessToken,
} from '../_lib/garminOAuth.js'
import { sendApiError } from '../_lib/apiError.js'
import { logApiEvent } from '../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Content-Type'],
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

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
    refresh_token?: string
  }
  const refreshToken = body.refresh_token

  if (!refreshToken) {
    return sendApiError(res, 400, 'refresh_token required', { source: req.headers })
  }

  const runtime = resolveKinetixRuntimeEnv()
  const clientId = runtime.garminConnectClientId
  const clientSecret = runtime.garminConnectClientSecret

  if (!clientId || !clientSecret) {
    return sendApiError(res, 500, 'Garmin Connect OAuth not configured on server', {
      source: req.headers,
    })
  }

  try {
    const token = await refreshGarminAccessToken({
      refreshToken,
      clientId,
      clientSecret,
    })
    res.status(200).json({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: garminAccessTokenExpiresAtSeconds(token.expires_in),
    })
  } catch (error) {
    if (error instanceof GarminAuthError) {
      logApiEvent('error', 'kinetix_garmin_refresh_failed', {
        message: error.message,
        details: error.details ?? null,
      })
      return sendApiError(res, error.status, error.message, {
        source: req.headers,
      })
    }
    logApiEvent('error', 'kinetix_garmin_refresh_failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return sendApiError(res, 500, 'Garmin token refresh failed', {
      source: req.headers,
    })
  }
}
