type BillingEnv = Record<string, string | undefined>

export function isBillingEnabled(env: BillingEnv = process.env, defaultValue = false): boolean {
  const raw = env.BILLING_ENABLED?.trim().toLowerCase()
  if (raw === 'true') {
    return true
  }
  if (raw === 'false') {
    return false
  }
  return defaultValue
}
