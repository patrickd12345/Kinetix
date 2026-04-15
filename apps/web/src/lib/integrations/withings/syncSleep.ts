import { withingsPost } from './client'
import { asCanonicalMetrics, normalizeSleep, toRawEvent } from './normalize'
import type { WithingsAuthCredentials, WithingsSyncDomainResult } from './types'

interface SleepBody {
  series?: Array<Record<string, number | string>>
}

export async function syncSleep(credentials: WithingsAuthCredentials, startDate?: string): Promise<WithingsSyncDomainResult> {
  const start = startDate ?? new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)
  const body = new URLSearchParams({ action: 'getsummary', startdateymd: start, enddateymd: new Date().toISOString().slice(0, 10) })
  const res = await withingsPost<SleepBody>(credentials, 'v2/sleep', body)

  if (res.status !== 0) return { rawEvents: [], metrics: [], capabilities: {}, errors: [`sleep status ${res.status}`] }

  const rows = (res.body?.series ?? []) as Array<Record<string, number | string>>
  const normalized = normalizeSleep(credentials.userId, `withings:sleep:${start}`, rows.map((r) => ({
    id: r.id,
    startdate: Number(r.startdate),
    enddate: Number(r.enddate),
    deepsleepduration: Number(r.deepsleepduration ?? 0),
    lightsleepduration: Number(r.lightsleepduration ?? 0),
    remsleepduration: Number(r.remsleepduration ?? 0),
    wakeupduration: Number(r.wakeupduration ?? 0),
    durationtosleep: Number(r.durationtosleep ?? 0),
  })))

  return {
    rawEvents: [toRawEvent(credentials.userId, 'sleep', rows)],
    metrics: asCanonicalMetrics({ sleep: normalized }),
    checkpointPatch: { lastSleepDate: new Date().toISOString().slice(0, 10) },
    capabilities: { sleep: normalized.length > 0 },
  }
}
