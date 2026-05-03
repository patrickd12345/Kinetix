import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { refreshGoogleAccessToken, GoogleAuthError } from '../_lib/googleAuth.js'
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

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

  const { refresh_token } = (req.body ?? {}) as { refresh_token?: string }
  if (!refresh_token) return sendApiError(res, 400, 'refresh_token required', { source: req.headers })

  const runtime = resolveKinetixRuntimeEnv()
  const clientId = runtime.googleClientId
  const clientSecret = runtime.googleClientSecret

  if (!clientSecret) {
    return sendApiError(res, 500, 'Google not configured. Set GOOGLE_CLIENT_SECRET.', {
      source: req.headers,
    })
  }

  try {
    const data = await refreshGoogleAccessToken({
      refreshToken: refresh_token,
      clientId,
      clientSecret,
    })
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      token_type: data.token_type,
    })
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return sendApiError(res, err.status, err.message, {
        source: req.headers,
      })
    }
    logApiEvent('error', 'kinetix_google_refresh_failed', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return sendApiError(res, 500, err instanceof Error ? err.message : 'Failed to refresh Google token', {
      source: req.headers,
    })
  }
}
