import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { applyCors } from '../../_lib/cors.js'
import { sendApiError } from '../../_lib/apiError.js'
import { logApiEvent } from '../../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../../_lib/env/runtime.js'
import { getSupabaseUserFromJwt } from '../../_lib/supabaseUserFromJwt.js'

/**
 * Ensures `platform.profiles` has a row for the authenticated user (native + web bootstrap).
 * iOS `PlatformIdentityService` sends an empty JSON body after sign-in.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
  })

  if (!cors.allowed) {
    return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  }

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

  const runtime = resolveKinetixRuntimeEnv()
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = runtime
  if (!supabaseUrl || !supabaseAnonKey) {
    return sendApiError(res, 500, 'Supabase URL/anon key not configured', { source: req.headers })
  }
  if (!supabaseServiceRoleKey) {
    logApiEvent('warn', 'kinetix_platform_profile_sync_missing_service_role', {})
    return sendApiError(res, 503, 'Profile sync unavailable: service role key not configured', {
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
    logApiEvent('warn', 'kinetix_platform_profile_sync_auth_failed', { message: 'Invalid JWT' })
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session' })
  }

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = new Date().toISOString()
  const { error } = await admin.schema('platform').from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      updated_at: now,
    },
    { onConflict: 'id' },
  )

  if (error) {
    logApiEvent('error', 'kinetix_platform_profile_sync_upsert_failed', { message: error.message })
    return sendApiError(res, 500, 'Failed to sync platform profile', {
      source: req.headers,
      details: error.message,
    })
  }

  return res.status(200).json({ ok: true })
}
