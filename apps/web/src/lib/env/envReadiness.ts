/**
 * Structured env/integration readiness for deployment diagnostics (KX-MVP-BETA-001).
 * Missing optional services should disable features, not crash the shell.
 */

import { supabase } from '../supabaseClient'
import { isBetaFullAccess } from '../features/featureFlags'

export type IntegrationReadiness = {
  ok: boolean
  reason?: string
}

export type EnvReadiness = {
  supabase: IntegrationReadiness
  auth: IntegrationReadiness
  rag: IntegrationReadiness
  withings: IntegrationReadiness
  garmin: IntegrationReadiness
  betaFullAccess: boolean
}

function trimEnv(key: string | undefined): string {
  return typeof key === 'string' ? key.trim() : ''
}

export function getSupabaseReadiness(): IntegrationReadiness {
  const url = trimEnv(import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = trimEnv(
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
      import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
  if (!url || !key) {
    return { ok: false, reason: 'missing_vite_supabase_url_or_anon_key' }
  }
  return { ok: true }
}

export function getAuthReadiness(): IntegrationReadiness {
  const s = getSupabaseReadiness()
  if (!s.ok) return { ok: false, reason: 'supabase_required_for_auth' }
  if (!supabase) return { ok: false, reason: 'supabase_client_null' }
  return { ok: true }
}

/**
 * RAG sync is only attempted when a service URL exists in production, or in dev (localhost probe).
 */
export function isRagServiceConfigured(): boolean {
  const explicit = trimEnv(import.meta.env.VITE_RAG_SERVICE_URL)
  if (explicit.length > 0) return true
  if (import.meta.env.DEV) return true
  return false
}

export function getRagReadiness(): IntegrationReadiness {
  if (isRagServiceConfigured()) return { ok: true }
  return { ok: false, reason: 'no_rag_url_in_production' }
}

/** Withings is optional; readiness reflects env hints only. */
export function getWithingsReadiness(): IntegrationReadiness {
  return { ok: true, reason: 'optional_client_side_oauth' }
}

/** Garmin Connect is optional; readiness reflects env hints only. */
export function getGarminReadiness(): IntegrationReadiness {
  return { ok: true, reason: 'optional_client_side_oauth' }
}

export function getEnvReadiness(): EnvReadiness {
  return {
    supabase: getSupabaseReadiness(),
    auth: getAuthReadiness(),
    rag: getRagReadiness(),
    withings: getWithingsReadiness(),
    garmin: getGarminReadiness(),
    betaFullAccess: isBetaFullAccess(),
  }
}
