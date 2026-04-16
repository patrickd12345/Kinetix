import type Stripe from 'stripe'

type StripeWebhookVerifier = {
  webhooks: {
    constructEvent: (
      payload: string,
      signature: string,
      webhookSecret: string,
    ) => Stripe.Event
  }
}

type VerifyStripeWebhookSignatureOptions = {
  stripe: StripeWebhookVerifier
  payload: string
  signature: string
  webhookSecret: string
}

export function verifyStripeWebhookSignature({
  stripe,
  payload,
  signature,
  webhookSecret,
}: VerifyStripeWebhookSignatureOptions): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}
