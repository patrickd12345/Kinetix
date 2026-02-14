import {
  BYOK_HEADER_NAME,
  readByokHeader,
  isValidByokKeyFormat,
  getByokDecision as coreGetByokDecision,
  mustRejectByok as coreMustReject,
  type ByokDecision,
  type ByokPolicyConfig,
} from '@bookiji/ai-core'

const KINETIX_POLICY: ByokPolicyConfig = {
  allowedSurfaces: [],
  byokSupported: false,
  proUsesPlatform: true,
}

export { BYOK_HEADER_NAME, readByokHeader, isValidByokKeyFormat }

export function getByokDecision(surface: string, byokKey: string | null): ByokDecision {
  return coreGetByokDecision({
    surface,
    isPro: false,
    byokKey,
    policy: KINETIX_POLICY,
    mode: (process.env.AI_MODE || '').toLowerCase() === 'local' ? 'local' : 'gateway',
  })
}

export function mustReject(decision: ByokDecision): boolean {
  return coreMustReject(decision)
}

export function getPolicy(): ByokPolicyConfig {
  return KINETIX_POLICY
}
