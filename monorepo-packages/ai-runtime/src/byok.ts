import type { CanonicalAiMode } from './types'

export const BYOK_HEADER_NAME = 'x-openai-key'

export type RequestHeaderSource =
  | Request
  | Headers
  | { headers?: Headers | { get: (name: string) => string | null } }
  | { get?: (name: string) => string | null }

export type ByokPolicyConfig = {
  allowedSurfaces: readonly string[]
  disallowedSurfaces?: readonly string[]
  byokSupported?: boolean
  proUsesPlatform?: boolean
}

export type ByokDecisionReason =
  | 'no_key'
  | 'invalid_key'
  | 'surface_not_allowed'
  | 'byok_not_supported'
  | 'pro_uses_platform'
  | 'byok_enabled'
  | 'byok_ignored_local'

export type ByokDecision = {
  effectiveMode: 'platform' | 'byok'
  allowed: boolean
  reason: ByokDecisionReason
}

export type ByokDecisionContext = {
  surface: string
  isPro: boolean
  byokKey: string | null
  policy: ByokPolicyConfig
  mode: CanonicalAiMode
}

function toSet(items?: readonly string[]) {
  return new Set(items ?? [])
}

function resolveHeaderCarrier(input: RequestHeaderSource): Headers | { get: (name: string) => string | null } | null {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.headers
  }
  if (typeof Headers !== 'undefined' && input instanceof Headers) {
    return input
  }
  const carrier = input as { headers?: Headers | { get: (name: string) => string | null }; get?: (name: string) => string | null }
  if (carrier?.headers) {
    return carrier.headers
  }
  if (typeof carrier?.get === 'function') {
    return carrier as { get: (name: string) => string | null }
  }
  return null
}

export function readByokHeader(source: RequestHeaderSource): string | null {
  const carrier = resolveHeaderCarrier(source)
  if (!carrier || typeof carrier.get !== 'function') {
    return null
  }
  const raw = carrier.get(BYOK_HEADER_NAME)
  if (!raw) {
    return null
  }
  const normalized = raw.trim()
  return normalized || null
}

export function isValidByokKeyFormat(key: string | null): boolean {
  if (!key) {
    return false
  }
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(key)
}

export function getByokDecision(ctx: ByokDecisionContext): ByokDecision {
  const hasKey = !!ctx.byokKey
  const allowed = toSet(ctx.policy.allowedSurfaces)
  const disallowed = toSet(ctx.policy.disallowedSurfaces)
  const byokSupported = ctx.policy.byokSupported ?? false
  const proUsesPlatform = ctx.policy.proUsesPlatform ?? true

  if (ctx.mode === 'ollama') {
    return {
      effectiveMode: 'platform',
      allowed: false,
      reason: hasKey ? 'byok_ignored_local' : 'no_key',
    }
  }

  if (ctx.policy.allowedSurfaces.length === 0) {
    return {
      effectiveMode: 'platform',
      allowed: false,
      reason: hasKey ? 'byok_not_supported' : 'no_key',
    }
  }

  const surfaceAllowed = allowed.has(ctx.surface)
  const surfaceDisallowed = disallowed.size > 0 && disallowed.has(ctx.surface)
  if (!surfaceAllowed || surfaceDisallowed) {
    return {
      effectiveMode: 'platform',
      allowed: false,
      reason: hasKey ? 'surface_not_allowed' : 'no_key',
    }
  }

  if (!hasKey) {
    return { effectiveMode: 'platform', allowed: false, reason: 'no_key' }
  }

  if (!isValidByokKeyFormat(ctx.byokKey)) {
    return { effectiveMode: 'platform', allowed: false, reason: 'invalid_key' }
  }

  if (proUsesPlatform && ctx.isPro) {
    return { effectiveMode: 'platform', allowed: false, reason: 'pro_uses_platform' }
  }

  if (!byokSupported) {
    return { effectiveMode: 'platform', allowed: false, reason: 'byok_not_supported' }
  }

  return { effectiveMode: 'byok', allowed: true, reason: 'byok_enabled' }
}

export function mustRejectByok(decision: ByokDecision): boolean {
  return (
    decision.reason === 'invalid_key' ||
    decision.reason === 'surface_not_allowed' ||
    decision.reason === 'byok_not_supported' ||
    decision.reason === 'pro_uses_platform'
  )
}
