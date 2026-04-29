/**
 * In-app feature flags (KX-MVP-BETA-001).
 * Beta default: full access for all authenticated users (no payments).
 * Set VITE_KINETIX_BETA_FULL_ACCESS=false post-beta to enable plan-based gating.
 */

import type { PlatformProfileRecord } from '../kinetixProfile'

export type Feature = 'recovery_coaching' | 'garmin_sync' | 'advanced_insights'

/**
 * When true (default), all features are enabled regardless of profile.plan.
 */
export function isBetaFullAccess(): boolean {
  const v = import.meta.env.VITE_KINETIX_BETA_FULL_ACCESS
  if (v === undefined || v === '') return true
  return v !== '0' && String(v).toLowerCase() !== 'false'
}

function getPlan(profile: PlatformProfileRecord | null | undefined): 'free' | 'pro' {
  if (!profile) return 'free'
  const m = profile.metadata as Record<string, unknown> | null | undefined
  const raw = m?.plan ?? m?.kinetix_plan
  if (typeof raw === 'string' && raw.toLowerCase() === 'pro') return 'pro'
  return 'free'
}

/**
 * Post-beta: returns true only for Pro when beta full access is off.
 * During beta: always true for all three features.
 */
export function isFeatureEnabled(_feature: Feature, profile: PlatformProfileRecord | null | undefined): boolean {
  if (isBetaFullAccess()) return true
  if (getPlan(profile) !== 'pro') return false
  return true
}
