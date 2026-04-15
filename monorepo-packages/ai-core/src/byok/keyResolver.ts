import { isProviderAllowedForProduct } from './keyScope.js'
import { getPlatformKey, loadUserKey } from './keyStorage.js'
import { validateProviderKey } from './keyValidation.js'

export type ResolveKeyInput = {
  userId: string
  provider: string
  product: string
  /** Optional env map (e.g. ai-runtime request.env) so platform keys resolve without relying on global process.env alone. */
  env?: Record<string, string | undefined>
}

export type ResolveKeyResult = {
  apiKey: string
  source: 'user' | 'platform'
}

/**
 * Resolve API credential: user-stored key first (when valid), else platform env key.
 * For `gateway`, a user OpenAI key (stored under provider `openai`) is treated as BYOK
 * and returned with source `user`; callers pair with platform gateway Bearer via splitGatewayKeys.
 */
/** Gateway: Bearer uses platform virtual key; user OpenAI key is BYOK attachment. */
export function splitGatewayKeys(
  resolved: ResolveKeyResult,
  platformGatewayKey: string | null,
): { bearerKey: string; byokKey: string | null } {
  if (resolved.source === 'user') {
    const bearer = platformGatewayKey?.trim()
    if (!bearer) {
      throw new Error('Gateway BYOK requires a platform gateway key (VERCEL_VIRTUAL_KEY / AI_GATEWAY_API_KEY).')
    }
    return { bearerKey: bearer, byokKey: resolved.apiKey }
  }
  return { bearerKey: resolved.apiKey, byokKey: null }
}

export async function resolveKey(input: ResolveKeyInput): Promise<ResolveKeyResult> {
  const { userId, provider, product, env: envMap } = input
  if (!userId?.trim()) {
    throw new Error('resolveKey requires userId')
  }
  if (!provider?.trim()) {
    throw new Error('resolveKey requires provider')
  }
  if (!product?.trim()) {
    throw new Error('resolveKey requires product')
  }

  if (!isProviderAllowedForProduct(provider, product)) {
    throw new Error(`Provider "${provider}" is not allowed for product "${product}"`)
  }

  if (provider === 'gateway') {
    const openaiUser = await loadUserKey(userId, 'openai', product)
    if (openaiUser && validateProviderKey('openai', openaiUser)) {
      return { apiKey: openaiUser.trim(), source: 'user' }
    }
    const gwUser = await loadUserKey(userId, 'gateway', product)
    if (gwUser && validateProviderKey('gateway', gwUser)) {
      return { apiKey: gwUser.trim(), source: 'user' }
    }
    const platform = getPlatformKey('gateway', envMap)
    if (!platform) {
      throw new Error(
        'Missing gateway platform key. Set VERCEL_VIRTUAL_KEY, AI_GATEWAY_API_KEY, or OPENAI_API_KEY.',
      )
    }
    return { apiKey: platform, source: 'platform' }
  }

  const userKey = await loadUserKey(userId, provider, product)
  if (userKey && validateProviderKey(provider, userKey)) {
    return { apiKey: userKey.trim(), source: 'user' }
  }

  const platformKey = getPlatformKey(provider, envMap)
  if (!platformKey) {
    throw new Error(`Missing platform API key for provider "${provider}"`)
  }
  return { apiKey: platformKey, source: 'platform' }
}
