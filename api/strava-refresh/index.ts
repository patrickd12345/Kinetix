import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors'
import { refreshStravaAccessToken, StravaAuthError } from '../_lib/stravaAuth'
import { sendApiError } from '../_lib/apiError'
import { logApiEvent } from '../_lib/observability'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Content-Type'],
  })

  if (!cors.allowed) {
    return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  }

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

  const { refresh_token } = (req.body ?? {}) as { refresh_token?: string }
  if (!refresh_token) return sendApiError(res, 400, 'refresh_token required', { source: req.headers })

  const runtime = resolveKinetixRuntimeEnv()
  const clientId = runtime.stravaClientId
  const clientSecret = runtime.stravaClientSecret

  if (!clientSecret) {
    return sendApiError(res, 500, 'Strava not configured. Set STRAVA_CLIENT_SECRET.', {
      source: req.headers,
    })
  }

  try {
    const data = await refreshStravaAccessToken({
      refreshToken: refresh_token,
      clientId,
      clientSecret,
    })
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    })
  } catch (err) {
    if (err instanceof StravaAuthError) {
      return sendApiError(res, err.status, err.message, {
        source: req.headers,
      })
    }
    logApiEvent('error', 'kinetix_strava_refresh_failed', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return sendApiError(res, 500, err instanceof Error ? err.message : 'Failed to refresh Strava token', {
      source: req.headers,
    })
  }
}
