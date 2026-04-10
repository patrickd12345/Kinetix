import type Stripe from 'stripe'

/** platform.entitlements.product_key for Kinetix paid access */
export const KINETIX_PRODUCT_KEY = 'kinetix' as const

export type CreateKinetixSubscriptionCheckoutSessionParams = {
  priceId: string
  userId: string
  email: string
  successUrl: string
  cancelUrl: string
  /** Existing Stripe customer id (optional) */
  customerId?: string
  /** Stored in metadata; upserted to platform.entitlements.entitlement_key */
  entitlementKey?: string
}

/**
 * Subscription Checkout for Kinetix: metadata on both the session and subscription
 * so Bookiji's canonical webhook can grant/revoke without a second endpoint.
 */
export async function createKinetixSubscriptionCheckoutSession(
  stripe: Stripe,
  params: CreateKinetixSubscriptionCheckoutSessionParams
): Promise<{ url: string | null; sessionId: string }> {
  const entitlementKey = params.entitlementKey ?? 'default'
  const meta: Record<string, string> = {
    product_key: KINETIX_PRODUCT_KEY,
    user_id: params.userId,
    entitlement_key: entitlementKey,
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId,
    customer_email: params.customerId ? undefined : params.email,
    customer: params.customerId,
    metadata: meta,
    subscription_data: {
      metadata: meta,
    },
  })

  return { url: session.url, sessionId: session.id }
}
