import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { sendApiError } from '../_lib/apiError.js'
import { logApiEvent } from '../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'
import { getProviderToken, requireSupabaseUser, upsertProviderToken } from '../_lib/providerTokenVault.js'
import { refreshStravaAccessToken } from '../_lib/stravaAuth.js'

const REFRESH_BUFFER_MS = 60 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['GET', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type'],
  })

  if (!cors.allowed) {
    return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return sendApiError(res, 405, 'Method not allowed', { source: req.headers })
  }

  const runtime = resolveKinetixRuntimeEnv()
  let user: { id: string }
  try {
    user = await requireSupabaseUser(req, runtime)
  } catch {
    return sendApiError(res, 401, 'Authentication required', { source: req.headers })
  }

  // Extract the path from the query string (everything after /api/strava/)
  // The rewrite rule passes the path as a query parameter
  const path = (req.query.path as string) || 'athlete/activities'
  const queryParams = new URLSearchParams()
  
  // Forward query parameters (excluding 'path' which is our internal routing param)
  Object.keys(req.query).forEach((key) => {
    if (key !== 'path' && req.query[key]) {
      const value = req.query[key]
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v))
      } else {
        queryParams.append(key, value as string)
      }
    }
  })

  const stravaUrl = `https://www.strava.com/api/v3/${path}${queryParams.toString() ? '?' + queryParams.toString() : ''}`

  try {
    let token = await getProviderToken(runtime, user.id, 'strava')
    if (!token) return sendApiError(res, 404, 'Strava connection not found', { source: req.headers })

    const expiresAtMs = token.expiresAt ? new Date(token.expiresAt).getTime() : 0
    if (expiresAtMs > 0 && expiresAtMs - Date.now() < REFRESH_BUFFER_MS) {
      const refreshed = await refreshStravaAccessToken({
        refreshToken: token.refreshToken,
        clientId: runtime.stravaClientId,
        clientSecret: runtime.stravaClientSecret,
      })
      const connection = await upsertProviderToken(runtime, {
        userId: user.id,
        provider: 'strava',
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        providerUserId: token.providerUserId,
        expiresAt: refreshed.expires_at ? new Date(refreshed.expires_at * 1000).toISOString() : null,
        scopes: ['activity:read_all'],
      })
      token = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        providerUserId: connection.provider_user_id ?? token.providerUserId,
        expiresAt: connection.expires_at ?? null,
      }
    }

    const response = await fetch(stravaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    // Handle non-OK responses
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const errorData = await response.json()
        return res.status(response.status).json(errorData)
      } else {
        const text = await response.text()
        return sendApiError(res, response.status, `Strava API error: ${response.status}`, {
          source: req.headers,
          details: text.substring(0, 200),
        })
      }
    }

    const data = await response.json()
    
    // Forward the status code and data
    res.status(response.status).json(data)
  } catch (error) {
    logApiEvent('error', 'kinetix_strava_proxy_failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return sendApiError(res, 500, 'Failed to proxy request to Strava API', {
      source: req.headers,
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
