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
} from '@bookiji-inc/platform-auth'

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  return { url, anonKey, serviceKey }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string) ??
    (req.headers['x-real-ip'] as string) ??
    'unknown'
  console.warn('[ADMLOG] Access attempt', {
    ip: clientIp,
    userAgent: req.headers['user-agent'],
    nodeEnv: process.env.NODE_ENV,
  })

  if (!isAdmlogEnabled()) {
    const { criteria, howToEnable } = getAdmlogBlockReason()
    console.warn('[ADMLOG] Blocked', { criteria, howToEnable })
    return res.status(403).json({
      error: 'Admlog is disabled',
      criteria,
      howToEnable,
    })
  }

  try {
    const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseConfig()
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return res.status(500).json({ error: 'Configuration missing' })
    }

    const { access_token, refresh_token } = await performAdmlogSignIn({
      supabaseUrl,
      serviceKey,
      anonKey,
    })

    console.warn('[ADMLOG] Token issued', { ip: clientIp })

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
      return res.status(400).json({ error: setError.message })
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
      : `http://localhost:${process.env.PORT ?? 5173}`
    return res.redirect(302, `${base}/admin`)
  } catch (error) {
    console.error('[ADMLOG] Error', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
