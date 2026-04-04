import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors'
import { exchangeWithingsCode } from '../_lib/withingsAuth'
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

  const { code, redirect_uri } = req.body ?? {}
  if (!code) return sendApiError(res, 400, 'Authorization code required', { source: req.headers })

  const runtime = resolveKinetixRuntimeEnv()
  const clientId = runtime.withingsClientId
  const clientSecret = runtime.withingsClientSecret
  const redirectUri = redirect_uri ?? `${req.headers.origin ?? ''}/settings`

  if (!clientId || !clientSecret) {
    return sendApiError(res, 500, 'Withings OAuth not configured. Set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET.', {
      source: req.headers,
    })
  }

  try {
    const result = await exchangeWithingsCode(
      { clientId, clientSecret, redirectUri },
      code
    )
    res.status(200).json({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      userid: result.userid,
      expires_in: result.expires_in,
    })
  } catch (err) {
    logApiEvent('error', 'kinetix_withings_oauth_failed', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return sendApiError(
      res,
      500,
      err instanceof Error ? err.message : 'Failed to exchange Withings authorization code',
      { source: req.headers }
    )
  }
}
