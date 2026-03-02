import { db, RunRecord, RUN_VISIBLE } from './database'
import { calculateKPS, UserProfile } from '@kinetix/core'
import { isValidRunForKPS } from './kpsUtils'
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

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
    }).catch((fetchError) => {
      // CORS or network error
      if (fetchError instanceof TypeError) {
        const errorMsg = fetchError.message.includes('CORS') || fetchError.message.includes('Failed to fetch')
          ? 'CORS error: Strava API blocks direct browser requests. Use dev server proxy or add backend proxy.'
          : fetchError.message
        throw new Error(errorMsg)
      }
      throw fetchError
    })

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`
      const contentType = response.headers.get('content-type') || ''
      try {
        if (contentType.includes('application/json')) {
          const errorData = await response.json()
          // Extract detailed error information from Strava API
          if (errorData.errors && Array.isArray(errorData.errors)) {
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

  if (!isValidRunForKPS({ distance: distanceMeters, duration })) {
    console.warn('Skipping Strava activity with invalid data:', {
      id: activity.id,
      name: activity.name,
      distance: distanceMeters,
      duration
    })
    return null
  }

  const kps = calculateKPS(
    { distanceKm: distanceMeters / 1000, timeSeconds: duration },
    userProfile
  )

  if (kps <= 0 || isNaN(kps) || !isFinite(kps)) {
    console.warn('Calculated invalid KPS for Strava activity:', {
      id: activity.id,
      name: activity.name,
      distance: distanceMeters,
      duration,
      kps
    })
    return null
  }

  return {
    date: activity.start_date,
    distance: distanceMeters,
    duration,
    averagePace: duration / (distanceMeters / 1000 || 1),
    kps,
    targetKPS,
    locations: [],
    splits: [],
    heartRate: activity.average_heartrate,
    notes: activity.name || `Strava Activity ${activity.id}`,
    source: 'strava',
  }
}

export type SyncStravaResult = { added: RunRecord[]; error?: string }

/**
 * Fetch new runs from Strava, dedupe against existing DB, add them, index in RAG.
 * Call on app startup when Strava is connected.
 */
export async function syncStravaRuns(
  token: string,
  userProfile: UserProfile,
  targetKPS: number
): Promise<SyncStravaResult> {
  if (!token?.trim()) return { added: [] }
  try {
    const activities = await fetchStravaActivities(token)
    if (activities.length === 0) {
      if (typeof console !== 'undefined') console.log('[Strava] No run activities returned from API')
      return { added: [] }
    }
    if (typeof console !== 'undefined') console.log('[Strava] Fetched', activities.length, 'run(s) from API')

    const existingRuns = (await db.runs.where('source').equals('strava').toArray()).filter(
      (r) => (r.deleted ?? 0) === RUN_VISIBLE
    )
    const existingKeys = new Set(
      existingRuns.map((r) => `${r.date}-${Math.round(r.distance)}`)
    )

    const records = activities
      .map((a) => convertStravaToRunRecord(a, userProfile, targetKPS))
      .filter((r): r is RunRecord => r !== null)
      .filter((r) => {
        const key = `${r.date}-${Math.round(r.distance)}`
        return !existingKeys.has(key)
      })

    if (records.length === 0) {
      if (activities.length > 0 && typeof console !== 'undefined') {
        console.log('[Strava] All', activities.length, 'run(s) already in history (no new runs to add)')
      }
      return { added: [] }
    }
    if (typeof console !== 'undefined') console.log('[Strava] Adding', records.length, 'new run(s)')

    const added: RunRecord[] = []
    for (const r of records) {
      const id = await db.runs.add(r)
      added.push({ ...r, id: id as number } as RunRecord)
    }

    const { indexRunsAfterSave } = await import('./ragClient')
    await indexRunsAfterSave(added, userProfile)

    if (added.length > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kinetix:runSaved'))
    }
    return { added }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Strava sync failed'
    console.error('[Strava] sync on startup:', msg, err)
    const isAuthError = typeof msg === 'string' && (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('token'))
    if (isAuthError && typeof window !== 'undefined') {
      const { setStravaCredentials, setStravaToken, setStravaSyncError } = useSettingsStore.getState()
      setStravaCredentials(null)
      setStravaToken('')
      setStravaSyncError('Connection expired. Disconnect and reconnect Strava in Settings.')
    }
    return { added: [], error: msg }
  }
}
