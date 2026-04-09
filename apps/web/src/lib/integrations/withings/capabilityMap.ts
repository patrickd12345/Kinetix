import type { CanonicalHealthMetric } from '../healthMetrics'
import type { WithingsCapabilityMap, WithingsSyncDomainResult } from './types'

export const EMPTY_WITHINGS_CAPABILITIES: WithingsCapabilityMap = {
  body: false,
  activity: false,
  workout: false,
  sleep: false,
  heart: false,
  bloodPressure: false,
}

export function deriveCapabilitiesFromMetrics(metrics: CanonicalHealthMetric[]): WithingsCapabilityMap {
  const out = { ...EMPTY_WITHINGS_CAPABILITIES }
  for (const metric of metrics) {
    if (metric.family === 'blood_pressure') out.bloodPressure = true
    if (metric.family === 'body') out.body = true
    if (metric.family === 'activity') out.activity = true
    if (metric.family === 'workout') out.workout = true
    if (metric.family === 'sleep') out.sleep = true
    if (metric.family === 'heart') out.heart = true
  }
  return out
}

export function mergeCapabilities(
  base: WithingsCapabilityMap,
  domainResults: WithingsSyncDomainResult[]
): WithingsCapabilityMap {
  const next = { ...base }
  for (const r of domainResults) {
    next.body = next.body || !!r.capabilities.body
    next.activity = next.activity || !!r.capabilities.activity
    next.workout = next.workout || !!r.capabilities.workout
    next.sleep = next.sleep || !!r.capabilities.sleep
    next.heart = next.heart || !!r.capabilities.heart
    next.bloodPressure = next.bloodPressure || !!r.capabilities.bloodPressure
  }
  return next
}
