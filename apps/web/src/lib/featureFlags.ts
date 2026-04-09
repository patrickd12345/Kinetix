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
    return readBooleanFlag(import.meta.env.VITE_ENABLE_OPERATOR_DASHBOARD, true)
  },
  get ENABLE_SLA_METRICS() {
    return readBooleanFlag(import.meta.env.VITE_ENABLE_SLA_METRICS, true)
  },
  get ENABLE_ESCALATION() {
    return readBooleanFlag(import.meta.env.VITE_ENABLE_ESCALATION, true)
  },
  get ENABLE_WITHINGS_EXPANDED_INGESTION() {
    return readBooleanFlag(import.meta.env.VITE_ENABLE_WITHINGS_EXPANDED_INGESTION, false)
  },
}
