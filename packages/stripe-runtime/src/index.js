export function isBillingEnabled(env = process.env) {
  return env.BILLING_ENABLED === 'true'
}

export async function createKinetixSubscriptionCheckoutSession(_stripe, args) {
  return { url: args.successUrl }
}
