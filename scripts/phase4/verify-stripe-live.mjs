#!/usr/bin/env node
/**
 * Asserts the live Stripe environment is internally consistent before flipping
 * BILLING_ENABLED in production.
 *
 * Reads (via Infisical or .env.local):
 *   STRIPE_SECRET_KEY        (must start with sk_live_)
 *   KINETIX_STRIPE_PRICE_ID
 *   STRIPE_WEBHOOK_SECRET    (optional shape check)
 *
 * Does NOT change anything. Read-only Stripe API calls only.
 */

import process from 'node:process'

const sk = process.env.STRIPE_SECRET_KEY
const priceId = process.env.KINETIX_STRIPE_PRICE_ID
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const failures = []
if (!sk) {
  failures.push('STRIPE_SECRET_KEY missing')
} else if (!sk.startsWith('sk_live_')) {
  failures.push(`STRIPE_SECRET_KEY is not a live key (starts with ${sk.slice(0, 8)})`)
}
if (!priceId) {
  failures.push('KINETIX_STRIPE_PRICE_ID missing')
}

if (failures.length) {
  console.error('STRIPE LIVE READINESS: FAIL (env)')
  for (const f of failures) console.error(' -', f)
  process.exit(2)
}

let Stripe
try {
  ;({ default: Stripe } = await import('stripe'))
} catch (err) {
  console.error('Failed to import stripe. Run pnpm install first.')
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(2)
}

const stripe = new Stripe(sk, { apiVersion: '2024-06-20' })

let price
try {
  price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
} catch (err) {
  console.error('STRIPE LIVE READINESS: FAIL (prices.retrieve)')
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

if (!price.active) failures.push(`price ${priceId} is not active`)
if (!price.livemode) failures.push(`price ${priceId} is not in livemode`)
if (price.product && typeof price.product !== 'string' && !price.product.active) {
  failures.push(`product ${price.product.id} is not active`)
}

if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
  failures.push('STRIPE_WEBHOOK_SECRET does not look like a webhook secret (whsec_)')
}

if (failures.length) {
  console.error('STRIPE LIVE READINESS: FAIL')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}

const interval = price.recurring?.interval || 'one_time'
const productId = typeof price.product === 'string' ? price.product : price.product?.id
console.log('STRIPE LIVE READINESS: PASS')
console.log(
  ` price=${price.id} product=${productId} amount=${price.unit_amount} ${price.currency} interval=${interval} active=${price.active} live=${price.livemode}`
)
