/**
 * DEV/STAGING ONLY — Admin one-shot login (Spine common trunk).
 * GET /api/admlog uses @bookiji-inc/platform-auth, sets session, redirects to app admin.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  isAdmlogEnabled,
  getAdmlogBlockReason,
  isAdmlogProductionEnvironment,
  performAdmlogSignIn,
} from '../_lib/platformAuth.js'
import { buildAdmlogSpaSessionHtml, sendAdmlogHtmlResponse } from './spaHtml.js'
import { sendApiError } from '../_lib/apiError.js'
import { buildKinetixApiError, getApiRequestId } from '../_lib/ai/error-contract.js'
import { getObservedRequestId, logApiEvent } from '../_lib/observability.js'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime.js'

function getSupabaseConfig() {
  const runtime = resolveKinetixRuntimeEnv()
  const url = runtime.supabaseUrl
  const anonKey = runtime.supabaseAnonKey
  const serviceKey = runtime.supabaseServiceRoleKey
  return { url, anonKey, serviceKey }
}

function describeMissingSupabaseConfig(parts: {
  supabaseUrl: string
  anonKey: string
  serviceKey: string
}): string {
  const missing: string[] = []
  if (!parts.supabaseUrl) {
    missing.push('project URL (set SUPABASE_URL or VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL)')
  }
  if (!parts.anonKey) {
    missing.push(
      'anon/publishable key (set SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)',
    )
  }
  if (!parts.serviceKey) {
    missing.push(
      'elevated server key for Auth Admin (prefer SUPABASE_SECRET_KEY = next-gen sb_secret_...; legacy SUPABASE_SERVICE_ROLE_KEY only if JWT legacy keys are enabled — never expose to the client)',
    )
  }
  return missing.length > 0 ? `Admlog configuration incomplete: missing ${missing.join('; ')}.` : ''
}

function getRedirectPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/operator'
  const candidate = raw.trim()
  if (!candidate.startsWith('/')) return '/operator'
  // Prevent protocol-relative redirects and keep this endpoint same-origin only.
  if (candidate.startsWith('//')) return '/operator'
  return candidate
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendApiError(res, 405, 'Method not allowed', { source: req.headers })
  }

  if (!isAdmlogEnabled()) {
    const { criteria, howToEnable } = getAdmlogBlockReason()
    logApiEvent('warn', 'kinetix_admlog_blocked', {
      criteria,
      howToEnable,
      production: isAdmlogProductionEnvironment(),
    })
    const payload = buildKinetixApiError(
      'forbidden',
      'Admlog is disabled',
      403,
      getApiRequestId(req.headers),
    )
    return res.status(403).json({
      error: 'Admlog is disabled',
      ...payload,
      criteria,
      howToEnable,
    })
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string) ??
    (req.headers['x-real-ip'] as string) ??
    'unknown'
  logApiEvent('warn', 'kinetix_admlog_access_attempt', {
    ip: clientIp,
    userAgent: req.headers['user-agent'],
    nodeEnv: resolveKinetixRuntimeEnv().nodeEnv,
  })

  try {
    const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseConfig()
    if (!supabaseUrl || !serviceKey || !anonKey) {
      const details = describeMissingSupabaseConfig({ supabaseUrl, anonKey, serviceKey })
      return sendApiError(res, 500, details || 'Configuration missing', { source: req.headers })
    }

    const { access_token, refresh_token } = await performAdmlogSignIn({
      supabaseUrl,
      serviceKey,
      anonKey,
      ensureEntitlementProductKeys: ['kinetix'],
    })

    logApiEvent('info', 'kinetix_admlog_token_issued', { ip: clientIp })

    const memoryClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    })
    const { data: sessionData, error: setSessionError } = await memoryClient.auth.setSession({
      access_token,
      refresh_token,
    })
    if (setSessionError || !sessionData.session) {
      return sendApiError(res, 400, setSessionError?.message ?? 'Failed to build browser session', {
        source: req.headers,
      })
    }

    const nextPath = getRedirectPath(req.query.next)
    const html = buildAdmlogSpaSessionHtml({
      session: sessionData.session,
      supabaseUrl,
      redirectPath: nextPath,
    })
    sendAdmlogHtmlResponse(res, html)
    return
  } catch (error) {
    logApiEvent('error', 'kinetix_admlog_error', {
      error: error instanceof Error ? error.message : String(error),
      requestId: getObservedRequestId(req.headers || {}),
    })
    return sendApiError(res, 500, 'Internal server error', {
      source: req.headers,
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
