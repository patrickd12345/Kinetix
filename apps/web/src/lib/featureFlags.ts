import { MASTER_ACCESS } from './debug/masterAccess'

function readBooleanFlag(value: string | boolean | undefined, fallback = true) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  return fallback
}

export const featureFlags = {
  get ENABLE_OPERATOR_DASHBOARD() {
    if (MASTER_ACCESS) return true
    return readBooleanFlag(import.meta.env.VITE_ENABLE_OPERATOR_DASHBOARD, true)
  },
  get ENABLE_SLA_METRICS() {
    if (MASTER_ACCESS) return true
    return readBooleanFlag(import.meta.env.VITE_ENABLE_SLA_METRICS, true)
  },
  get ENABLE_ESCALATION() {
    if (MASTER_ACCESS) return true
    return readBooleanFlag(import.meta.env.VITE_ENABLE_ESCALATION, true)
  },
  /**
   * Full Withings domain sync (activity, sleep, etc.) + scheduled slots in Settings.
   * Production defaults off (API load); local `vite` dev defaults on so controls are usable without env.
   * Set `VITE_ENABLE_WITHINGS_EXPANDED_INGESTION=false` in `.env.local` to disable in dev.
   */
  get ENABLE_WITHINGS_EXPANDED_INGESTION() {
    if (MASTER_ACCESS) return true
    const env = import.meta.env.VITE_ENABLE_WITHINGS_EXPANDED_INGESTION
    if (import.meta.env.DEV) {
      return readBooleanFlag(env, true)
    }
    return readBooleanFlag(env, false)
  },
}
