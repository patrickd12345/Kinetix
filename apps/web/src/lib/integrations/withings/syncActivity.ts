import { withingsPost } from './client'
import { asCanonicalMetrics, normalizeActivity, toRawEvent } from './normalize'
import type { WithingsAuthCredentials, WithingsSyncDomainResult } from './types'

interface ActivityBody { activities?: Array<Record<string, number | string>> }

export async function syncActivity(credentials: WithingsAuthCredentials, date?: string): Promise<WithingsSyncDomainResult> {
  const targetDate = date ?? new Date().toISOString().slice(0, 10)
  const body = new URLSearchParams({ action: 'getactivity', data_fields: 'steps,distance,elevation,calories,hr_zone_0,hr_zone_1,hr_zone_2,hr_zone_3', startdateymd: targetDate, enddateymd: targetDate })
  const res = await withingsPost<ActivityBody>(credentials, 'v2/measure', body)
  if (res.status !== 0) return { rawEvents: [], metrics: [], capabilities: {}, errors: [`activity status ${res.status}`] }

  const rows = (res.body?.activities ?? []) as Array<Record<string, number | string>>
  const normalized = normalizeActivity(credentials.userId, `withings:activity:${targetDate}`, rows.map((r) => ({
    date: String(r.date),
    steps: Number(r.steps ?? 0),
    distance: Number(r.distance ?? 0),
    calories: Number(r.calories ?? 0),
    elevation: Number(r.elevation ?? 0),
    hr_zone_0: Number(r.hr_zone_0 ?? 0),
    hr_zone_1: Number(r.hr_zone_1 ?? 0),
    hr_zone_2: Number(r.hr_zone_2 ?? 0),
    hr_zone_3: Number(r.hr_zone_3 ?? 0),
  })))

  return {
    rawEvents: [toRawEvent(credentials.userId, 'activity', rows)],
    metrics: asCanonicalMetrics({ activity: normalized }),
    checkpointPatch: { lastActivityDate: targetDate },
    capabilities: { activity: normalized.length > 0 },
  }
}
