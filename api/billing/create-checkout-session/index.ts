import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createKinetixSubscriptionCheckoutSession } from '@bookiji-inc/stripe-runtime'
import { applyCors } from '../../_lib/cors'
import { sendApiError } from '../../_lib/apiError'
import { logApiEvent } from '../../_lib/observability'
import { resolveKinetixRuntimeEnv } from '../../_lib/env/runtime'
import { assertKinetixCheckoutEnv, getKinetixStripeOrThrow } from '../../_lib/kinetixStripe'
import { getSupabaseUserFromJwt } from '../../_lib/supabaseUserFromJwt'

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
    return res.status(503).json({ error: 'billing_unavailable', message: billing.message })
  }

  const runtime = resolveKinetixRuntimeEnv()
  const { supabaseUrl, supabaseAnonKey, kinetixStripePriceId } = runtime
  if (!supabaseUrl || !supabaseAnonKey) {
    return sendApiError(res, 500, 'Supabase URL/anon key not configured', { source: req.headers })
  }

  const authHeader = (req.headers.authorization ?? req.headers.Authorization) as string | undefined
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : ''
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authorization Bearer token required' })
  }

  const user = await getSupabaseUserFromJwt(supabaseUrl, supabaseAnonKey, token)
  if (!user?.id) {
    logApiEvent('warn', 'kinetix_checkout_auth_failed', { message: 'Invalid JWT or auth/v1/user failed' })
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session' })
  }

  const body = (req.body ?? {}) as { successUrl?: string; cancelUrl?: string; entitlementKey?: string }
  const { successUrl, cancelUrl, entitlementKey } = body
  if (!successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'missing_parameters', message: 'successUrl and cancelUrl are required' })
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
      return res.status(500).json({ error: 'checkout_failed', message: 'Stripe did not return a checkout URL' })
    }
    return res.status(200).json({ url })
  } catch (err) {
    logApiEvent('error', 'kinetix_checkout_session_failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    return res.status(500).json({
      error: 'checkout_failed',
      message: err instanceof Error ? err.message : 'Failed to create checkout session',
    })
  }
}
