import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { refreshStravaAccessToken, StravaAuthError } from '../_lib/stravaAuth.js'
import { sendApiError } from '../_lib/apiError.js'
import { logApiEvent } from '../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'
import { getProviderToken, requireSupabaseUser, upsertProviderToken } from '../_lib/providerTokenVault.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type'],
  })

  if (!cors.allowed) {
    return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  }

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

  const runtime = resolveKinetixRuntimeEnv()
  let user: { id: string }
  try {
    user = await requireSupabaseUser(req, runtime)
  } catch {
    return sendApiError(res, 401, 'Authentication required', { source: req.headers })
  }
  const clientId = runtime.stravaClientId
  const clientSecret = runtime.stravaClientSecret

  if (!clientSecret) {
    return sendApiError(res, 500, 'Strava not configured. Set STRAVA_CLIENT_SECRET.', {
      source: req.headers,
    })
  }

  try {
    const existing = await getProviderToken(runtime, user.id, 'strava')
    if (!existing) return sendApiError(res, 404, 'Strava connection not found', { source: req.headers })
    const data = await refreshStravaAccessToken({
      refreshToken: existing.refreshToken,
      clientId,
      clientSecret,
    })
    const expiresAt = data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null
    const connection = await upsertProviderToken(runtime, {
      userId: user.id,
      provider: 'strava',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      providerUserId: existing.providerUserId,
      expiresAt,
      scopes: ['activity:read_all'],
    })
    return res.status(200).json(connection)
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
