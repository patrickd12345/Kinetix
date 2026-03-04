/**
 * BYOK (Bring Your Own Key) policy and helpers - Kinetix local implementation.
 * All AI utilities for web API live under api/_lib/ai/*.
 */

export const BYOK_HEADER_NAME = 'x-openai-key'

export interface ByokPolicyConfig {
  allowedSurfaces: string[]
  byokSupported: boolean
  proUsesPlatform: boolean
}

export interface ByokDecision {
  reject: boolean
}

const KINETIX_POLICY: ByokPolicyConfig = {
  allowedSurfaces: [],
  byokSupported: false,
  proUsesPlatform: true,
}

export function getPolicy(): ByokPolicyConfig {
  return KINETIX_POLICY
}

export function readByokHeader(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const v = headers[BYOK_HEADER_NAME.toLowerCase()] ?? headers['x-openai-key']
  if (typeof v === 'string') return v.trim() || null
  if (Array.isArray(v) && v[0]) return String(v[0]).trim() || null
  return null
}

export function isValidByokKeyFormat(key: string | null): boolean {
  if (!key || typeof key !== 'string') return false
  return key.length >= 10
}

export function getByokDecision(_surface: string, byokKey: string | null): ByokDecision {
  if (byokKey && !KINETIX_POLICY.byokSupported) {
    return { reject: true }
  }
  return { reject: false }
}

export function mustReject(decision: ByokDecision): boolean {
  return decision.reject
}
