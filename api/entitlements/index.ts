import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { applyCors } from '../_lib/cors.js'
import { sendApiError } from '../_lib/apiError.js'
import { logApiEvent } from '../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'
import { getSupabaseUserFromJwt } from '../_lib/supabaseUserFromJwt.js'
import { aggregateEntitlementPayload, parseProductKey } from '../_lib/platformEntitlements.js'
import { captureApiException, withSentryApiHandler } from '../_lib/sentry.js'

async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['GET', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
  })

  if (!cors.allowed) {
    return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  }

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

  const runtime = resolveKinetixRuntimeEnv()
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = runtime
  if (!supabaseUrl || !supabaseAnonKey) {
    return sendApiError(res, 500, 'Supabase URL/anon key not configured', { source: req.headers })
  }
  if (!supabaseServiceRoleKey) {
    logApiEvent('warn', 'kinetix_entitlements_missing_service_role', {})
    return sendApiError(res, 503, 'Entitlements unavailable: service role key not configured', {
      source: req.headers,
    })
  }

  const authHeader = (req.headers.authorization ?? req.headers.Authorization) as string | undefined
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : ''
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authorization Bearer token required' })
  }

  const user = await getSupabaseUserFromJwt(supabaseUrl, supabaseAnonKey, token)
  if (!user?.id) {
    logApiEvent('warn', 'kinetix_entitlements_auth_failed', { message: 'Invalid JWT' })
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session' })
  }

  const qp = req.query?.product_key
  const rawKey = typeof qp === 'string' ? qp : Array.isArray(qp) ? qp[0] : undefined
  const productKey = parseProductKey(rawKey)
  if (!productKey) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'product_key query parameter must be one of: bookiji, kinetix, chess',
    })
  }

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin
    .schema('platform')
    .from('entitlements')
    .select('active, status, ends_at, expires_at, source, entitlement_key')
    .eq('user_id', user.id)
    .eq('product_key', productKey)

  if (error) {
    logApiEvent('error', 'kinetix_entitlements_query_failed', { message: error.message })
    return sendApiError(res, 500, 'Failed to load entitlements', {
      source: req.headers,
      details: error.message,
    })
  }

  const payload = aggregateEntitlementPayload(data ?? [])
  try {
    return res.status(200).json(payload)
  } catch (error) {
    captureApiException(error)
    throw error
  }
}

export default withSentryApiHandler(handler)
