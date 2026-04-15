import { syncMeasures } from './syncMeasures'
import type { WithingsAuthCredentials, WithingsSyncDomainResult } from './types'

export async function syncHeart(credentials: WithingsAuthCredentials, lastUpdate?: number): Promise<WithingsSyncDomainResult> {
  const result = await syncMeasures(credentials, lastUpdate)
  const metrics = result.metrics.filter((metric) => metric.family === 'heart')
  return {
    rawEvents: result.rawEvents,
    metrics,
    checkpointPatch: result.checkpointPatch,
    capabilities: { heart: metrics.length > 0 },
    errors: result.errors,
  }
}
