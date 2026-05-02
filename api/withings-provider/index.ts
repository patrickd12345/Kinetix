import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { sendApiError } from '../_lib/apiError.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'
import { refreshWithingsToken } from '../_lib/withingsAuth.js'
import { getProviderToken, requireSupabaseUser, upsertProviderToken } from '../_lib/providerTokenVault.js'

const WITHINGS_API = 'https://wbsapi.withings.net'
const REFRESH_BUFFER_MS = 5 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type'],
  })
  if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

  const runtime = resolveKinetixRuntimeEnv()
  let user: { id: string }
  try {
    user = await requireSupabaseUser(req, runtime)
  } catch {
    return sendApiError(res, 401, 'Authentication required', { source: req.headers })
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
    path?: string
    body?: string
  }
  const path = typeof body.path === 'string' ? body.path.replace(/^\/+/, '') : ''
  if (!path || path.includes('..') || path.startsWith('v2/oauth2')) {
    return sendApiError(res, 400, 'Invalid Withings provider path', { source: req.headers })
  }

  try {
    let token = await getProviderToken(runtime, user.id, 'withings')
    if (!token) return sendApiError(res, 404, 'Withings connection not found', { source: req.headers })

    const expiresAtMs = token.expiresAt ? new Date(token.expiresAt).getTime() : 0
    if (expiresAtMs > 0 && expiresAtMs - Date.now() < REFRESH_BUFFER_MS) {
      const refreshed = await refreshWithingsToken(
        { clientId: runtime.withingsClientId, clientSecret: runtime.withingsClientSecret },
        token.refreshToken,
      )
      const connection = await upsertProviderToken(runtime, {
        userId: user.id,
        provider: 'withings',
        providerUserId: String(refreshed.userid || token.providerUserId || ''),
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        scopes: ['user.metrics'],
      })
      token = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        providerUserId: connection.provider_user_id ?? token.providerUserId,
        expiresAt: connection.expires_at ?? null,
      }
    }

    const upstream = await fetch(`${WITHINGS_API}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: typeof body.body === 'string' ? body.body : '',
    })
    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
    return res.send(text)
  } catch (error) {
    return sendApiError(res, 500, error instanceof Error ? error.message : 'Withings provider request failed', {
      source: req.headers,
    })
  }
}

