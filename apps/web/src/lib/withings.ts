import type { WithingsCredentials } from '../store/settingsStore'
import { bulkPutWeightEntries, getMaxWeightDateUnix, type WeightEntry } from './database'

const WITHINGS_MEASURE_URL = 'https://wbsapi.withings.net/measure'

/** Measure type 1 = weight; unit -2 means value * 10^-2 = kg */
const WEIGHT_TYPE = 1
const WEIGHT_UNIT_EXP = -2

export interface WithingsMeasure {
  value: number
  unit: number
  type: number
}

/** Raw measure group from Withings `getmeas` (one page). */
type WithingsMeasureGroup = { measures?: WithingsMeasure[]; date: string | number }

interface GetMeasJson {
  status?: number
  body?: {
    measuregrps?: WithingsMeasureGroup[]
    /** 1 = more pages; use `offset` on the next request */
    more?: number
    /** Next `offset` query value for pagination */
    offset?: number
    error?: string
  }
}

const GETMEAS_MAX_PAGES = 250

/** Category 1 = real device measurements (not user objectives). Omitting this can yield incomplete data. */
const CATEGORY_REAL = '1'

function getMeasHasMore(body: GetMeasJson['body']): boolean {
  const m = body?.more
  return Number(m) === 1
}

/**
 * Withings `getmeas` returns a **single page** of `measuregrps`. When `body.more` is set,
 * repeat with `offset` from the response or recent weigh-ins never appear.
 * @see https://developer.withings.com/api-reference/#operation/measure-getmeas
 */
async function fetchAllWeightMeasureGroupsInRange(
  accessToken: string,
  startUnix: number,
  endUnix: number
): Promise<WithingsMeasureGroup[]> {
  const all: WithingsMeasureGroup[] = []
  let requestOffset = 0

  for (let page = 0; page < GETMEAS_MAX_PAGES; page++) {
    const body = new URLSearchParams({
      action: 'getmeas',
      category: CATEGORY_REAL,
      startdate: String(startUnix),
      enddate: String(endUnix),
      meastypes: String(WEIGHT_TYPE),
    })
    if (requestOffset > 0) body.set('offset', String(requestOffset))

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
      console.warn('Withings getmeas HTTP error:', res.status, text)
      break
    }

    const json = (await res.json()) as GetMeasJson
    if (json.status !== 0) {
      console.warn('Withings getmeas status:', json.status, json.body?.error)
      break
    }

    const groups = json.body?.measuregrps ?? []
    all.push(...groups)

    if (!getMeasHasMore(json.body)) break
    const nextOffset = json.body?.offset
    if (nextOffset == null) break
    const next = typeof nextOffset === 'number' ? nextOffset : parseInt(String(nextOffset), 10)
    if (!Number.isFinite(next) || next === requestOffset) break
    requestOffset = next
  }

  return all
}

/**
 * Incremental sync: all weight groups created/updated **after** `lastUpdateUnix` (Withings recommends
 * this over date windows alone to avoid gaps). Uses `lastupdate` only — not `startdate`/`enddate`.
 * @see https://developer.withings.com/developer-guide/v3/tutorials/how-to-compute-lastupdate
 */
async function fetchAllWeightMeasureGroupsSinceLastUpdate(
  accessToken: string,
  lastUpdateUnix: number
): Promise<WithingsMeasureGroup[]> {
  const all: WithingsMeasureGroup[] = []
  let requestOffset = 0

  for (let page = 0; page < GETMEAS_MAX_PAGES; page++) {
    const body = new URLSearchParams({
      action: 'getmeas',
      category: CATEGORY_REAL,
      lastupdate: String(lastUpdateUnix),
      meastypes: String(WEIGHT_TYPE),
    })
    if (requestOffset > 0) body.set('offset', String(requestOffset))

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
      console.warn('Withings getmeas (lastupdate) HTTP error:', res.status, text)
      break
    }

    const json = (await res.json()) as GetMeasJson
    if (json.status !== 0) {
      console.warn('Withings getmeas (lastupdate) status:', json.status, json.body?.error)
      break
    }

    const groups = json.body?.measuregrps ?? []
    all.push(...groups)

    if (!getMeasHasMore(json.body)) break
    const nextOffset = json.body?.offset
    if (nextOffset == null) break
    const next = typeof nextOffset === 'number' ? nextOffset : parseInt(String(nextOffset), 10)
    if (!Number.isFinite(next) || next === requestOffset) break
    requestOffset = next
  }

  return all
}

function mergeWeightEntriesPreferLater(a: WeightEntry[], b: WeightEntry[]): WeightEntry[] {
  const map = new Map<number, WeightEntry>()
  for (const e of a) map.set(e.dateUnix, e)
  for (const e of b) map.set(e.dateUnix, e)
  return [...map.values()].sort((x, y) => y.dateUnix - x.dateUnix)
}

function measureGroupsToWeightEntries(groups: WithingsMeasureGroup[]): WeightEntry[] {
  const entries: WeightEntry[] = []
  for (const g of groups) {
    const w = g.measures?.find((m) => m.type === WEIGHT_TYPE)
    if (!w) continue
    const exp = typeof w.unit === 'number' ? w.unit : WEIGHT_UNIT_EXP
    const kg = w.value * Math.pow(10, exp)
    const dateUnix = typeof g.date === 'number' ? g.date : parseInt(String(g.date), 10) || 0
    if (dateUnix <= 0) continue
    entries.push({
      dateUnix,
      date: new Date(dateUnix * 1000).toISOString(),
      kg: Math.round(kg * 100) / 100,
    })
  }
  return entries.sort((a, b) => b.dateUnix - a.dateUnix)
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
  const groups = await fetchAllWeightMeasureGroupsInRange(accessToken, start, end)
  const entries = measureGroupsToWeightEntries(groups)
  return entries.length > 0 ? entries[0].kg : null
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
 * Combines a rolling date window with an optional `lastupdate` pass (see `getMaxWeightDateUnix`) so
 * new weigh-ins are not missed when the window query alone is incomplete.
 */
export async function fetchRecentWithingsWeights(
  accessToken: string,
  daysBack: number = 30
): Promise<WeightEntry[]> {
  const end = Math.floor(Date.now() / 1000)
  const start = end - daysBack * 24 * 3600
  const rangeGroups = await fetchAllWeightMeasureGroupsInRange(accessToken, start, end)
  const rangeEntries = measureGroupsToWeightEntries(rangeGroups)

  const maxLocal = await getMaxWeightDateUnix()
  if (maxLocal == null || maxLocal <= 0) {
    return rangeEntries
  }

  const sinceGroups = await fetchAllWeightMeasureGroupsSinceLastUpdate(accessToken, maxLocal)
  const sinceEntries = measureGroupsToWeightEntries(sinceGroups)
  const merged = mergeWeightEntriesPreferLater(rangeEntries, sinceEntries)
  return merged
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

  /** 120-day window + `lastupdate` merge inside `fetchRecentWithingsWeights`. */
  const entries = await fetchRecentWithingsWeights(valid.accessToken, 120)
  if (entries.length > 0) {
    await bulkPutWeightEntries(entries)
  }

  /** Avoid a second full API walk when the merged batch already includes the latest weigh-in. */
  const latestKg =
    entries.length > 0 ? entries[0].kg : await fetchLatestWeightFromWithings(valid.accessToken)
  return { latestKg, historyEntriesSynced: entries.length }
}

/** `window` event name fired after a successful startup/manual Withings sync (history + latest kg). */
export const WITHINGS_WEIGHTS_SYNCED_EVENT = 'kinetix:withingsWeightsSynced'
