export function isBillingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BILLING_ENABLED === 'true'
}

export async function createKinetixSubscriptionCheckoutSession(_stripe: unknown, args: { successUrl: string }) {
  return { url: args.successUrl }
}
