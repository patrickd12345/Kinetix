import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { exchangeWithingsCode } from '../_lib/withingsAuth.js'
import { sendApiError } from '../_lib/apiError.js'
import { logApiEvent } from '../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'
import { resolveWithingsRedirectUriForTokenExchange } from '../_lib/withingsRedirectUri.js'

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

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
    code?: string
    redirect_uri?: string
  }
  const { code, redirect_uri } = body
  if (!code) return sendApiError(res, 400, 'Authorization code required', { source: req.headers })

  const runtime = resolveKinetixRuntimeEnv()
  const clientId = runtime.withingsClientId
  const clientSecret = runtime.withingsClientSecret
  const originHeader = req.headers.origin
  const redirectUri = resolveWithingsRedirectUriForTokenExchange({
    bodyRedirectUri: typeof redirect_uri === 'string' ? redirect_uri : undefined,
    envRedirectUri: runtime.withingsRedirectUri,
    requestOrigin: typeof originHeader === 'string' ? originHeader : undefined,
  })
  if (!redirectUri) {
    return sendApiError(res, 400, 'redirect_uri required (send client callback URL or set WITHINGS_REDIRECT_URI)', {
      source: req.headers,
    })
  }

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
    const message = err instanceof Error ? err.message : 'Failed to exchange Withings authorization code'
    logApiEvent('error', 'kinetix_withings_oauth_failed', {
      message,
      redirectUri,
    })
    const hint = /redirect_uri|callback|mismatch/i.test(message)
      ? `Register this exact callback URL in the Withings partner app (Callback / redirect URI): ${redirectUri}`
      : undefined
    return sendApiError(res, 500, message, {
      source: req.headers,
      details: hint || undefined,
    })
  }
}
