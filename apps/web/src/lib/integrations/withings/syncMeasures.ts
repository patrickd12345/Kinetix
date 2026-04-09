import { withingsPost } from './client'
import { asCanonicalMetrics, normalizeBloodPressure, normalizeBodyMeasures, normalizeHeartFromMeasures, toRawEvent } from './normalize'
import type { WithingsAuthCredentials, WithingsMeasureGroup, WithingsSyncDomainResult } from './types'

interface GetMeasBody {
  measuregrps?: WithingsMeasureGroup[]
  updatetime?: number
}

export async function syncMeasures(credentials: WithingsAuthCredentials, lastUpdate?: number): Promise<WithingsSyncDomainResult> {
  const body = new URLSearchParams({ action: 'getmeas', category: '1' })
  if (lastUpdate != null && lastUpdate > 0) body.set('lastupdate', String(lastUpdate))

  const res = await withingsPost<GetMeasBody>(credentials, 'measure', body)
  if (res.status !== 0) {
    return {
      rawEvents: [], metrics: [], capabilities: {}, errors: [`measure sync status ${res.status}`],
    }
  }

  const groups = res.body?.measuregrps ?? []
  const syncRef = `withings:measure:${new Date().toISOString()}`
  const rawEvents = [toRawEvent(credentials.userId, 'body', groups)]
  const bodyMetrics = normalizeBodyMeasures(credentials.userId, syncRef, groups)
  const heartMetrics = normalizeHeartFromMeasures(credentials.userId, syncRef, groups)
  const bpMetrics = normalizeBloodPressure(credentials.userId, syncRef, groups)

  return {
    rawEvents,
    metrics: asCanonicalMetrics({ body: bodyMetrics, heart: heartMetrics, bloodPressure: bpMetrics }),
    checkpointPatch: { lastMeasureUpdate: res.body?.updatetime ?? lastUpdate },
    capabilities: {
      body: bodyMetrics.length > 0,
      heart: heartMetrics.length > 0,
      bloodPressure: bpMetrics.length > 0,
    },
  }
}
