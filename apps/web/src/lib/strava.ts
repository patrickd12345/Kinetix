import { db, RunRecord, getWeightsForDates } from './database'
import { UserProfile } from '@kinetix/core'
import { isMeaningfulRunForKPS } from './kpsUtils'
import { indexRunsAfterSave } from './ragClient'
import { resolveProfileForRunWithWeightCache } from './authState'
import { useSettingsStore } from '../store/settingsStore'

/** Refresh if token expires within 1 hour. Returns valid access token or empty string. */
export async function getValidStravaToken(): Promise<string> {
  const { stravaCredentials, stravaToken, setStravaCredentials } = useSettingsStore.getState()
  if (stravaCredentials) {
    const now = Math.floor(Date.now() / 1000)
    const bufferSec = 3600
    if (stravaCredentials.expiresAt > now + bufferSec) {
      return stravaCredentials.accessToken
    }
    try {
      const res = await fetch('/api/strava-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: stravaCredentials.refreshToken }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.warn('[Strava] Token refresh failed:', (err as { error?: string }).error)
        setStravaCredentials(null)
        return ''
      }
      const data = (await res.json()) as { access_token: string; refresh_token: string; expires_at: number }
      const creds = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      }
      setStravaCredentials(creds)
      return creds.accessToken
    } catch (e) {
      console.warn('[Strava] Token refresh error:', e)
      setStravaCredentials(null)
      return ''
    }
  }
  return stravaToken?.trim() ?? ''
}

export interface StravaActivity {
  id: number
  name: string
  type: string // 'Run', 'Ride', 'Swim', etc.
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  start_date_local: string
  start_latlng: [number, number] | null
  end_latlng: [number, number] | null
  average_speed: number
  max_speed: number
  average_heartrate?: number
  max_heartrate?: number
  start_date: string
}

export async function fetchStravaActivities(
  token: string,
  afterEpoch?: number,
  beforeEpoch?: number
): Promise<StravaActivity[]> {
  if (!token) {
    throw new Error('Strava token required')
  }

  const perPage = 100
  let page = 1
  const results: StravaActivity[] = []
  let hasMorePages = true

  while (hasMorePages) {
    const params = new URLSearchParams({
      per_page: perPage.toString(),
      page: page.toString(),
    })
    if (afterEpoch) params.append('after', afterEpoch.toString())
    if (beforeEpoch) params.append('before', beforeEpoch.toString())

    // Use proxy in development (Vite dev server) and production (Vercel serverless function)
    const apiUrl = `/api/strava/athlete/activities?${params.toString()}`

    const doFetch = async (): Promise<Response> => {
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      }).catch((fetchError) => {
        if (fetchError instanceof TypeError) {
          const errorMsg = fetchError.message.includes('CORS') || fetchError.message.includes('Failed to fetch')
            ? 'CORS error: Strava API blocks direct browser requests. Use dev server proxy or add backend proxy.'
            : fetchError.message
          throw new Error(errorMsg)
        }
        throw fetchError
      })
      return res
    }

    const response = await doFetch()

    if (response.status === 429) {
      throw new Error('Strava API error: Rate limit reached. Sync will retry on next app load.')
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`
      const contentType = response.headers.get('content-type') || ''
      try {
        if (contentType.includes('application/json')) {
          const errorData = await response.json()
          if (response.status === 429) {
            errorMessage = 'Rate limit reached. Sync will retry on next app load.'
          } else if (errorData.errors && Array.isArray(errorData.errors)) {
            const scopeError = errorData.errors.find((e: any) => e.field?.includes('permission') || e.field?.includes('scope'))
            if (scopeError) {
              errorMessage = `Token missing required scope. Please generate a new token with 'activity:read_all' scope at https://www.strava.com/settings/api. The error field was: ${scopeError.field}`
            } else {
              errorMessage = errorData.message || errorData.error || errorMessage
            }
          } else {
            errorMessage = errorData.message || errorData.error || errorMessage
          }
        } else {
          const text = await response.text()
          errorMessage = text || errorMessage
        }
      } catch (parseError) {
        // Error parsing failed, use default message
      }
      if (response.status === 429 || (typeof errorMessage === 'string' && /rate limit/i.test(errorMessage))) {
        errorMessage = 'Rate limit reached. Sync will retry on next app load.'
      }
      throw new Error(`Strava API error: ${errorMessage}`)
    }

    const pageResults = (await response.json()) as StravaActivity[]
    
    // Filter to only include runs
    const runs = pageResults.filter(activity => activity.type === 'Run')
    
    if (runs.length === 0) {
      // If no runs in this page, check if we should continue
      if (pageResults.length < perPage) {
        hasMorePages = false
        continue
      }
      page += 1
      continue // Skip to next page
    }

    results.push(...runs)
    if (pageResults.length < perPage) {
      hasMorePages = false
      continue
    }

    page += 1
    // Throttle to avoid burst (Strava: 100 read/15min)
    await new Promise((r) => setTimeout(r, 200))
  }

  return results
}

export function convertStravaToRunRecord(
  activity: StravaActivity,
  userProfile: UserProfile,
  targetKPS: number
): RunRecord | null {
  const duration = activity.moving_time
  const distanceMeters = activity.distance

  if (!isMeaningfulRunForKPS({ distance: distanceMeters, duration })) {
    console.warn('Skipping Strava activity (too short for meaningful KPS):', {
      id: activity.id,
      name: activity.name,
      distance: distanceMeters,
      duration
    })
    return null
  }

  return {
    external_id: activity.id.toString(),
    date: activity.start_date,
    distance: distanceMeters,
    duration,
    averagePace: duration / (distanceMeters / 1000 || 1),
    targetKPS,
    locations: [],
    splits: [],
    heartRate: activity.average_heartrate,
    notes: activity.name || `Strava Activity ${activity.id}`,
    source: 'strava',
    weightKg: userProfile.weightKg,
  }
}

export type SyncStravaResult = { added: RunRecord[]; error?: string }

export interface SyncStravaOptions {
  /** Limit to activities from the last N days (reduces API calls on startup). */
  recentDays?: number
}

/**
 * Fetch new runs from Strava, dedupe against existing DB, add them, index in RAG.
 * Call on app startup when Strava is connected.
 */
export async function syncStravaRuns(
  token: string,
  targetKPS: number,
  options?: SyncStravaOptions
): Promise<SyncStravaResult> {
  if (!token?.trim()) return { added: [] }
  try {
    // Determine overlapping boundary date using local history.
    // 1. Boundary source must be only source='strava' records.
    const allStravaRuns = await db.runs.where('source').equals('strava').toArray()
    let afterEpoch: number | undefined = undefined

    if (allStravaRuns.length > 0) {
      // 2. Prefer the latest imported Strava record that has external_id populated.
      // 3. Use that record's activity timestamp as the incremental lower bound.
      // (Even if deleted, we don't want to re-import it, so we include logically deleted ones)
      const runsWithExternalId = allStravaRuns.filter(r => r.external_id)
      const boundaryRuns = runsWithExternalId.length > 0 ? runsWithExternalId : allStravaRuns

      const latestRunDate = boundaryRuns.reduce((latest, run) => {
        return run.date > latest ? run.date : latest
      }, boundaryRuns[0].date)

      // Calculate overlap: Use latest date minus 7 days buffer (for safety).
      const latestEpoch = Math.floor(new Date(latestRunDate).getTime() / 1000)
      const overlapBufferSeconds = 7 * 86400 // 7 days overlap buffer
      afterEpoch = latestEpoch - overlapBufferSeconds
    } else if (options?.recentDays != null) {
      // Fallback for first import if explicit limit provided
      afterEpoch = Math.floor(Date.now() / 1000) - options.recentDays * 86400
    }

    const activities = await fetchStravaActivities(token, afterEpoch)
    if (activities.length === 0) {
      if (typeof console !== 'undefined') console.log('[Strava] No run activities returned from API')
      return { added: [] }
    }
    if (typeof console !== 'undefined') console.log('[Strava] Fetched', activities.length, 'run(s) from API')

    // Local deduplication: Use existing runs including logically deleted runs to prevent re-adding.
    // 1. Dedup by external_id
    const existingIds = new Set(allStravaRuns.map(r => r.external_id).filter(Boolean) as string[])
    // 2. Legacy fallback: Dedup by date + distance for older runs without external_id
    const legacyKeys = new Set(
      allStravaRuns.filter(r => !r.external_id).map((r) => `${r.date}-${Math.round(r.distance)}`)
    )

    const activityDates = activities.map((a) => a.start_date)
    const weightByDate = await getWeightsForDates(activityDates)

    const records = activities
      .map((a) => {
        const profileForDate = resolveProfileForRunWithWeightCache(weightByDate, { date: a.start_date })
        return convertStravaToRunRecord(a, profileForDate, targetKPS)
      })
      .filter((r): r is RunRecord => r !== null)
      .filter((r) => {
        if (r.external_id && existingIds.has(r.external_id)) {
          return false
        }
        const legacyKey = `${r.date}-${Math.round(r.distance)}`
        return !legacyKeys.has(legacyKey)
      })

    if (records.length === 0) {
      if (activities.length > 0 && typeof console !== 'undefined') {
        console.log('[Strava] All', activities.length, 'run(s) already in history (no new runs to add)')
      }
      return { added: [] }
    }
    if (typeof console !== 'undefined') console.log('[Strava] Adding', records.length, 'new run(s)')

    const ids = await db.runs.bulkAdd(records, { allKeys: true })
    const added = records.map((r, i) => ({ ...r, id: ids[i] as number }))

    await indexRunsAfterSave(added)

    if (added.length > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kinetix:runSaved'))
    }
    return { added }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Strava sync failed'
    console.error('[Strava] sync on startup:', msg, err)
    const isRateLimit = typeof msg === 'string' && /rate limit/i.test(msg)
    const lower = typeof msg === 'string' ? msg.toLowerCase() : ''
    const isAuthError =
      !isRateLimit &&
      typeof msg === 'string' &&
      (msg.includes('401') ||
        lower.includes('unauthorized') ||
        lower.includes('authorization error') ||
        lower.includes('token'))
    if (isAuthError && typeof window !== 'undefined') {
      const { setStravaCredentials, setStravaToken, setStravaSyncError } = useSettingsStore.getState()
      setStravaCredentials(null)
      setStravaToken('')
      setStravaSyncError('Connection expired. Disconnect and reconnect Strava in Settings.')
    }
    return { added: [], error: msg }
  }
}
