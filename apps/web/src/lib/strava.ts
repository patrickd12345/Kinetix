import { RunRecord } from './database'
import { calculateKPS, UserProfile } from '@kinetix/core'
import { isValidRunForKPS } from './kpsUtils'

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
