/**
 * DEV/STAGING ONLY — Admin one-shot login (Spine common trunk).
 * GET /api/admlog uses @bookiji-inc/platform-auth, sets session, redirects to app admin.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient } from '@supabase/ssr'
import {
  isAdmlogEnabled,
  getAdmlogBlockReason,
  performAdmlogSignIn,
} from '../_lib/platformAuth'
import { sendApiError } from '../_lib/apiError'
import { buildKinetixApiError, getApiRequestId } from '../_lib/ai/error-contract'
import { getObservedRequestId, logApiEvent } from '../_lib/observability'
import { resolveKinetixRuntimeEnv } from '../_lib/env/runtime'

/** Matches @bookiji-inc/platform-auth production detection (admlog must never run here). */
function isProductionDeployment(): boolean {
  if (process.env.NODE_ENV === 'production') return true
  if (process.env.VERCEL_ENV === 'production') return true
  return false
}

function getAdmlogBlockResponseBody() {
  if (isProductionDeployment()) {
    return {
      criteria: ['NODE_ENV or VERCEL_ENV is production'],
      howToEnable:
        'Admlog is disabled in production by design. Do not set ADMLOG_ENABLED or BOOKIJI_TEST_MODE on Vercel Production. Use Preview, staging, or local dev only.',
    }
  }
  return getAdmlogBlockReason()
}

function getSupabaseConfig() {
  const runtime = resolveKinetixRuntimeEnv()
  const url = runtime.supabaseUrl
  const anonKey = runtime.supabaseAnonKey
  const serviceKey = runtime.supabaseServiceRoleKey
  return { url, anonKey, serviceKey }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendApiError(res, 405, 'Method not allowed', { source: req.headers })
  }

  if (!isAdmlogEnabled()) {
    const { criteria, howToEnable } = getAdmlogBlockResponseBody()
    logApiEvent('warn', 'kinetix_admlog_blocked', {
      criteria,
      howToEnable,
      production: isProductionDeployment(),
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
      return sendApiError(res, 500, 'Configuration missing', { source: req.headers })
    }

    const { access_token, refresh_token } = await performAdmlogSignIn({
      supabaseUrl,
      serviceKey,
      anonKey,
    })

    logApiEvent('info', 'kinetix_admlog_token_issued', { ip: clientIp })

    const cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[] = []
    const cookieHeader = (req.headers.cookie as string) ?? ''
    const getAll = () =>
      cookieHeader
        ? cookieHeader.split('; ').map((s) => {
            const [name, ...v] = s.split('=')
            return { name: name ?? '', value: decodeURIComponent((v ?? []).join('=')) }
          })
        : []
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll,
        setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.push(...cookies)
        },
      },
    })

    const { error: setError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })
    if (setError) {
      return sendApiError(res, 400, setError.message, { source: req.headers })
    }

    const isLocal = /localhost|127\.0\.0\.1/.test(supabaseUrl)
    cookiesToSet.forEach(({ name, value, options }) => {
      const opts = (options ?? {}) as { path?: string; maxAge?: number; sameSite?: string; secure?: boolean }
      let header = `${name}=${encodeURIComponent(value)}; Path=${opts.path ?? '/'}; Max-Age=${opts.maxAge ?? 60 * 60 * 24 * 7}`
      if (opts.sameSite) header += `; SameSite=${opts.sameSite}`
      if (!isLocal && opts.secure !== false) header += '; Secure'
      res.appendHeader('Set-Cookie', header)
    })

    const base = (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host'])
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : `http://localhost:${resolveKinetixRuntimeEnv().port || 5173}`
    return res.redirect(302, `${base}/admin`)
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
