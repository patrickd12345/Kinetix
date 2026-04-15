/**
 * Which providers are allowed for a given product id.
 * Extend as new products ship.
 */
const DEFAULT_ALLOWED: Record<string, readonly string[]> = {
  kinetix: ['openai', 'anthropic', 'gemini', 'gateway'],
  default: ['openai', 'anthropic', 'gemini', 'gateway'],
}

export function isProviderAllowedForProduct(provider: string, product: string): boolean {
  const list = DEFAULT_ALLOWED[product] ?? DEFAULT_ALLOWED.default
  return list.includes(provider)
}
