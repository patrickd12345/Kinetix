import Stripe from 'stripe'
import { isBillingEnabled } from '@bookiji-inc/stripe-runtime'
import { resolveKinetixRuntimeEnv } from './env/runtime'

export function getKinetixStripeOrThrow(): Stripe {
  const { stripeSecretKey } = resolveKinetixRuntimeEnv()
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(stripeSecretKey, { apiVersion: '2026-02-25.clover' })
}

export function assertKinetixCheckoutEnv(): { ok: true } | { ok: false; message: string } {
  if (!isBillingEnabled(process.env)) {
    return { ok: false, message: 'Billing is disabled (set BILLING_ENABLED=true).' }
  }
  const runtime = resolveKinetixRuntimeEnv()
  if (!runtime.stripeSecretKey) {
    return { ok: false, message: 'STRIPE_SECRET_KEY is not set.' }
  }
  if (!runtime.kinetixStripePriceId) {
    return { ok: false, message: 'KINETIX_STRIPE_PRICE_ID is not set.' }
  }
  return { ok: true }
}
