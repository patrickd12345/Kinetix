import { withingsPost } from './client'
import { asCanonicalMetrics, normalizeWorkouts, toRawEvent } from './normalize'
import type { WithingsAuthCredentials, WithingsSyncDomainResult } from './types'

interface WorkoutBody {
  activities?: Array<Record<string, number | string>>
}

export async function syncWorkouts(credentials: WithingsAuthCredentials, startDate?: string): Promise<WithingsSyncDomainResult> {
  const start = startDate ?? new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10)
  const body = new URLSearchParams({ action: 'getworkouts', startdateymd: start, enddateymd: new Date().toISOString().slice(0, 10) })
  const res = await withingsPost<WorkoutBody>(credentials, 'v2/measure', body)

  if (res.status !== 0) return { rawEvents: [], metrics: [], capabilities: {}, errors: [`workout status ${res.status}`] }

  const rows = (res.body?.activities ?? []) as Array<Record<string, number | string>>
  const normalized = normalizeWorkouts(credentials.userId, `withings:workout:${start}`, rows.map((r) => ({
    id: String(r.id),
    startdate: Number(r.startdate),
    enddate: Number(r.enddate),
    category: r.category,
    distance: Number(r.distance ?? 0),
    calories: Number(r.calories ?? 0),
    hr_average: Number(r.hr_average ?? 0),
    hr_max: Number(r.hr_max ?? 0),
  })))

  return {
    rawEvents: [toRawEvent(credentials.userId, 'workout', rows)],
    metrics: asCanonicalMetrics({ workout: normalized }),
    checkpointPatch: { lastWorkoutDate: new Date().toISOString().slice(0, 10) },
    capabilities: { workout: normalized.length > 0 },
  }
}
