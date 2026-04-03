import type { WithingsCredentials } from '../store/settingsStore'
import { bulkPutWeightEntries, type WeightEntry } from './database'

const WITHINGS_MEASURE_URL = 'https://wbsapi.withings.net/measure'

/** Measure type 1 = weight; unit -2 means value * 10^-2 = kg */
const WEIGHT_TYPE = 1
const WEIGHT_UNIT_EXP = -2

export interface WithingsMeasure {
  value: number
  unit: number
  type: number
}

/**
 * Refresh Withings access token using the backend (client secret required).
 * Returns new credentials; caller should persist them.
 */
export async function refreshWithingsToken(refreshToken: string): Promise<WithingsCredentials> {
  const res = await fetch('/api/withings-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to refresh Withings token')
  }
  const data = await res.json()
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3 * 3600
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: String(data.userid ?? data.user_id ?? ''),
    expiresAt: Date.now() + expiresIn * 1000,
  }
}

/**
 * Ensure we have a valid access token; refresh if within 5 minutes of expiry.
 * Returns updated credentials if refreshed; caller should persist.
 */
export async function ensureValidWithingsAccess(
  creds: WithingsCredentials
): Promise<WithingsCredentials> {
  const bufferMs = 5 * 60 * 1000
  if (Date.now() < creds.expiresAt - bufferMs) return creds
  return refreshWithingsToken(creds.refreshToken)
}

/**
 * Fetch latest weight from Withings Measure API (getmeas).
 * Uses Bearer token; no client secret. Returns weight in kg or null.
 */
export async function fetchLatestWeightFromWithings(
  accessToken: string
): Promise<number | null> {
  const end = Math.floor(Date.now() / 1000)
  const start = end - 365 * 24 * 3600
  const body = new URLSearchParams({
    action: 'getmeas',
    startdate: String(start),
    enddate: String(end),
    meastypes: String(WEIGHT_TYPE),
  })

  const res = await fetch(WITHINGS_MEASURE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    console.warn('Withings getmeas error:', res.status, text)
    return null
  }

  const json = await res.json()
  const meas = json?.body?.measuregrps as Array<{ measures: WithingsMeasure[]; date: string }> | undefined
  if (!Array.isArray(meas) || meas.length === 0) return null

  const withWeights = meas
    .map((g) => {
      const w = g.measures?.find((m: WithingsMeasure) => m.type === WEIGHT_TYPE)
      if (!w) return null
      const exp = typeof w.unit === 'number' ? w.unit : WEIGHT_UNIT_EXP
      const kg = w.value * Math.pow(10, exp)
      return { kg, date: parseInt(g.date, 10) || 0 }
    })
    .filter((x): x is { kg: number; date: number } => x !== null)
    .sort((a, b) => b.date - a.date)

  const latest = withWeights[0]
  return latest ? latest.kg : null
}

/**
 * Get latest weight using stored credentials. Refreshes token if needed.
 * Returns weight in kg or null; optionally returns updated credentials to persist.
 */
export async function getWithingsWeight(
  creds: WithingsCredentials,
  onNewCredentials?: (c: WithingsCredentials) => void
): Promise<number | null> {
  const valid = await ensureValidWithingsAccess(creds)
  if (valid !== creds) onNewCredentials?.(valid)
  const kg = await fetchLatestWeightFromWithings(valid.accessToken)
  return kg
}

/**
 * Fetch recent weight measurements from Withings and return as WeightEntry[].
 * Used on startup to append new weigh-ins to the weight history table without re-importing JSON.
 */
export async function fetchRecentWithingsWeights(
  accessToken: string,
  daysBack: number = 30
): Promise<WeightEntry[]> {
  const end = Math.floor(Date.now() / 1000)
  const start = end - daysBack * 24 * 3600
  const body = new URLSearchParams({
    action: 'getmeas',
    startdate: String(start),
    enddate: String(end),
    meastypes: String(WEIGHT_TYPE),
  })

  const res = await fetch(WITHINGS_MEASURE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) return []

  const json = (await res.json()) as {
    body?: { measuregrps?: Array<{ measures?: WithingsMeasure[]; date: string | number }> }
  }
  const groups = json?.body?.measuregrps ?? []
  const entries: WeightEntry[] = []

  for (const g of groups) {
    const w = g.measures?.find((m) => m.type === WEIGHT_TYPE)
    if (!w) continue
    const exp = typeof w.unit === 'number' ? w.unit : WEIGHT_UNIT_EXP
    const kg = w.value * Math.pow(10, exp)
    const dateUnix = typeof g.date === 'number' ? g.date : parseInt(String(g.date), 10) || 0
    entries.push({
      dateUnix,
      date: new Date(dateUnix * 1000).toISOString(),
      kg: Math.round(kg * 100) / 100,
    })
  }

  return entries.sort((a, b) => b.dateUnix - a.dateUnix)
}

export interface WithingsStartupSyncResult {
  /** Latest weight from Measure API (kg), for `lastWithingsWeightKg` */
  latestKg: number | null
  /** Rows merged into `weightHistory` */
  historyEntriesSynced: number
}

/**
 * Startup / background sync: refresh token, merge recent measurements into IndexedDB,
 * and always resolve the latest scale weight from the API (even when the recent window
 * returns no new rows — e.g. first open after a long break).
 */
export async function syncWithingsWeightsAtStartup(
  creds: WithingsCredentials,
  onCredentialsUpdate?: (c: WithingsCredentials) => void
): Promise<WithingsStartupSyncResult> {
  const valid = await ensureValidWithingsAccess(creds)
  if (valid !== creds) onCredentialsUpdate?.(valid)

  const entries = await fetchRecentWithingsWeights(valid.accessToken, 90)
  if (entries.length > 0) {
    await bulkPutWeightEntries(entries)
  }

  const latestKg = await fetchLatestWeightFromWithings(valid.accessToken)
  return { latestKg, historyEntriesSynced: entries.length }
}
