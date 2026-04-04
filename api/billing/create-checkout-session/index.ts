import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createKinetixSubscriptionCheckoutSession } from '@bookiji-inc/stripe-runtime'
import { applyCors } from '../../_lib/cors'
import { sendApiError } from '../../_lib/apiError'
import { logApiEvent } from '../../_lib/observability'
import { resolveKinetixRuntimeEnv } from '../../_lib/env/runtime'
import { assertKinetixCheckoutEnv, getKinetixStripeOrThrow } from '../../_lib/kinetixStripe'

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

  const billing = assertKinetixCheckoutEnv()
  if (!billing.ok) {
    return sendApiError(res, 503, billing.message, {
      code: 'billing_unavailable',
      source: req.headers,
    })
  }

  const runtime = resolveKinetixRuntimeEnv()
  const { supabaseUrl, supabaseAnonKey, kinetixStripePriceId } = runtime
  if (!supabaseUrl || !supabaseAnonKey) {
    return sendApiError(res, 500, 'Supabase URL/anon key not configured', { source: req.headers })
  }

  const authHeader = (req.headers.authorization ?? req.headers.Authorization) as string | undefined
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : ''
  if (!token) {
    return sendApiError(res, 401, 'Authorization Bearer token required', { source: req.headers })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)
  if (userError || !user?.id) {
    logApiEvent('warn', 'kinetix_checkout_auth_failed', { message: userError?.message })
    return sendApiError(res, 401, 'Invalid or expired session', { source: req.headers })
  }

  const body = (req.body ?? {}) as { successUrl?: string; cancelUrl?: string; entitlementKey?: string }
  const { successUrl, cancelUrl, entitlementKey } = body
  if (!successUrl || !cancelUrl) {
    return sendApiError(res, 400, 'successUrl and cancelUrl are required', {
      code: 'missing_parameters',
      source: req.headers,
    })
  }

  try {
    const stripe = getKinetixStripeOrThrow()
    const { url } = await createKinetixSubscriptionCheckoutSession(stripe, {
      priceId: kinetixStripePriceId,
      userId: user.id,
      email: user.email ?? '',
      successUrl,
      cancelUrl,
      entitlementKey,
    })
    if (!url) {
      return sendApiError(res, 500, 'Stripe did not return a checkout URL', {
        code: 'checkout_failed',
        source: req.headers,
      })
    }
    return res.status(200).json({ url })
  } catch (err) {
    logApiEvent('error', 'kinetix_checkout_session_failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    return sendApiError(res, 500, err instanceof Error ? err.message : 'Failed to create checkout session', {
      code: 'checkout_failed',
      source: req.headers,
    })
  }
}
