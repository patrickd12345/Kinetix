import { useSettingsStore } from '../store/settingsStore'
import { KINETIX_PERFORMANCE_SCORE } from '../lib/branding'
import { fetchStravaActivities, convertStravaToRunRecord } from '../lib/strava'
import { db, RunRecord } from '../lib/database'
import { useState, useEffect, useRef } from 'react'
import { useStravaAuth } from '../hooks/useStravaAuth'
import { useWithingsAuth } from '../hooks/useWithingsAuth'
import { getWithingsWeight } from '../lib/withings'
import { importGarminFromZipFile } from '../lib/garminImport'
import { convertGarminToRunRecord } from '../lib/garmin'
import { indexRunsAfterSave, reindexAllRunsInRAG } from '../lib/ragClient'
import { useAuth } from '../components/providers/useAuth'
import { getProfileLabel, toKinetixUserProfile } from '../lib/kinetixProfile'

export default function Settings() {
  const {
    targetKPS,
    setTargetKPS,
    unitSystem,
    setUnitSystem,
    physioMode,
    setPhysioMode,
    stravaToken,
    setStravaToken,
    weightSource,
    setWeightSource,
    withingsCredentials,
    setWithingsCredentials,
    lastWithingsWeightKg,
    setLastWithingsWeightKg,
  } = useSettingsStore()
  const { profile, session } = useAuth()
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [reindexing, setReindexing] = useState(false)
  const [reindexMessage, setReindexMessage] = useState<string | null>(null)
  const garminZipInputRef = useRef<HTMLInputElement>(null)
  const { initiateOAuth, handleOAuthCallback } = useStravaAuth()
  const { initiateOAuth: initiateWithingsOAuth, handleOAuthCallback: handleWithingsCallback, disconnect: disconnectWithings } = useWithingsAuth()
  const [withingsRefreshing, setWithingsRefreshing] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')
    const state = urlParams.get('state')

    if (error) {
      setImportMessage(`Error: ${error}`)
      return
    }

    if (!code) return

    const storageKey = state === 'withings' ? 'withings_oauth_code' : 'strava_oauth_code'
    if (sessionStorage.getItem(storageKey) === code) return
    sessionStorage.setItem(storageKey, code)

    if (state === 'withings') {
      handleWithingsCallback(code)
        .then(async () => {
          setImportMessage('Withings connected. Fetching latest weight…')
          const creds = useSettingsStore.getState().withingsCredentials
          if (creds) {
            const kg = await getWithingsWeight(creds, (c) => useSettingsStore.getState().setWithingsCredentials(c))
            if (kg != null) useSettingsStore.getState().setLastWithingsWeightKg(kg)
            setImportMessage(kg != null ? `Withings connected. Weight: ${kg.toFixed(1)} kg` : 'Withings connected. No weight data yet.')
          } else {
            setImportMessage('Withings connected.')
          }
        })
        .catch((err) => {
          setImportMessage(`Error connecting to Withings: ${err.message}`)
          sessionStorage.removeItem(storageKey)
        })
      return
    }

    handleOAuthCallback(code)
      .then(() => {
        setImportMessage('Successfully connected to Strava!')
      })
      .catch((err) => {
        setImportMessage(`Error connecting to Strava: ${err.message}`)
        sessionStorage.removeItem(storageKey)
      })
  }, [handleOAuthCallback, handleWithingsCallback])

  const userProfile = profile ? toKinetixUserProfile(profile) : null
  const profileLabel = profile ? getProfileLabel(profile, session?.user.email ?? null) : ''

  if (!profile) {
    return (
      <div className="pb-20 lg:pb-4">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <div className="glass rounded-2xl border border-yellow-500/30 p-6 space-y-2">
            <h1 className="text-lg font-bold text-yellow-300">Loading profile...</h1>
            <p className="text-sm text-gray-300">
              Your platform profile is still loading. If this persists, refresh the page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const safeUserProfile = toKinetixUserProfile(profile)

  return (
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <div className="glass rounded-2xl p-6 space-y-6">
          <div className="rounded-xl border border-white/10 bg-gray-900/30 p-3">
            <div className="text-xs text-gray-400 uppercase mb-1">Platform identity</div>
            <div className="text-sm text-white font-medium">{profileLabel}</div>
            <div className="text-xs text-gray-500 mt-1">Profile ID: {profile.id}</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Target {KINETIX_PERFORMANCE_SCORE}</label>
            <input
              type="number"
              value={targetKPS}
              onChange={(e) => setTargetKPS(parseFloat(e.target.value) || 135)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Weight for KPS</label>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="weightSource"
                  checked={weightSource === 'profile'}
                  onChange={() => setWeightSource('profile')}
                  className="rounded"
                />
                <span className="text-sm">Platform profile</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="weightSource"
                  checked={weightSource === 'withings'}
                  onChange={() => setWeightSource('withings')}
                  className="rounded"
                  disabled={!withingsCredentials}
                />
                <span className="text-sm">Withings</span>
              </label>
            </div>
            <div className="rounded-xl border border-white/10 bg-gray-900/30 p-3 space-y-2">
              <div className="text-xs text-gray-400 uppercase">Withings (smart scale)</div>
              <p className="text-[11px] text-gray-500">
                Use your latest Withings scale weight for KPS. Connect and we fetch the most recent measurement.
              </p>
              {!withingsCredentials ? (
                <button
                  type="button"
                  onClick={() => initiateWithingsOAuth()}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-full transition"
                >
                  Connect Withings
                </button>
              ) : (
                <>
                  <p className="text-[11px] text-green-400">Connected to Withings</p>
                  {lastWithingsWeightKg > 0 && (
                    <p className="text-sm text-white">Latest weight: {lastWithingsWeightKg.toFixed(1)} kg</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={withingsRefreshing}
                      onClick={async () => {
                        if (!withingsCredentials) return
                        setWithingsRefreshing(true)
                        try {
                          const kg = await getWithingsWeight(withingsCredentials, setWithingsCredentials)
                          if (kg != null) setLastWithingsWeightKg(kg)
                          setImportMessage(kg != null ? `Weight updated: ${kg.toFixed(1)} kg` : 'No weight data from Withings.')
                        } catch (e) {
                          setImportMessage(`Error: ${e instanceof Error ? e.message : 'Failed to fetch weight'}`)
                        } finally {
                          setWithingsRefreshing(false)
                        }
                      }}
                      className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-full transition disabled:opacity-50"
                    >
                      {withingsRefreshing ? 'Refreshing…' : 'Refresh weight'}
                    </button>
                    <button
                      type="button"
                      onClick={() => disconnectWithings()}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Unit System</label>
            <select
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value as 'metric' | 'imperial')}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2"
            >
              <option value="metric">Metric (km)</option>
              <option value="imperial">Imperial (miles)</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Physio-Pacer Mode</label>
            <button
              onClick={() => setPhysioMode(!physioMode)}
              aria-label="Toggle Physio-Pacer Mode"
              aria-pressed={physioMode}
              className={`w-12 h-6 rounded-full transition-all ${
                physioMode ? 'bg-green-500' : 'bg-gray-700'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${
                physioMode ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-400 uppercase">Strava Sync</div>
                <p className="text-[11px] text-gray-500 mb-2">
                  Connect your Strava account to import your running history.
                </p>
                {!stravaToken ? (
                  <button
                    onClick={initiateOAuth}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-full transition mb-2"
                  >
                    Connect with Strava
                  </button>
                ) : (
                  <p className="text-[11px] text-green-400 mb-2">✓ Connected to Strava</p>
                )}
              </div>
              <button
                onClick={async () => {
                  setImportMessage(null)
                  try {
                    setImporting(true)
                    const activities = await fetchStravaActivities(stravaToken)
                    
                    if (activities.length === 0) {
                      setImportMessage('No running activities found in your Strava history.')
                      return
                    }

                    // Check for duplicates by comparing date and distance
                    const existingRuns = await db.runs.where('source').equals('strava').toArray()
                    const existingKeys = new Set(
                      existingRuns.map(run => `${run.date}-${Math.round(run.distance)}`)
                    )

                    const records = activities
                      .map((activity) => convertStravaToRunRecord(activity, safeUserProfile, targetKPS))
                      .filter((record): record is RunRecord => record !== null)
                      .filter((record) => {
                        const key = `${record.date}-${Math.round(record.distance)}`
                        return !existingKeys.has(key)
                      })

                    if (records.length === 0) {
                      setImportMessage('All activities are already imported.')
                      return
                    }

                    await db.runs.bulkAdd(records)
                    await indexRunsAfterSave(records, safeUserProfile)
                    setImportMessage(`Imported ${records.length} new run${records.length > 1 ? 's' : ''} from Strava.`)
                  } catch (error) {
                    console.error('Strava import error', error)
                    const errorMsg = error instanceof Error ? error.message : 'Failed to import from Strava. Check token.'
                    setImportMessage(`Error: ${errorMsg}`)
                  } finally {
                    setImporting(false)
                  }
                }}
                className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-full transition"
                disabled={importing || !stravaToken.trim()}
              >
                {importing ? 'Importing…' : 'Import from Strava'}
              </button>
            </div>
            <input
              type="password"
              value={stravaToken}
              onChange={(e) => setStravaToken(e.target.value)}
              placeholder={stravaToken ? "Token connected via OAuth" : "Or paste token manually"}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-sm"
              disabled={!!stravaToken}
            />
            {stravaToken && (
              <button
                onClick={() => setStravaToken('')}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Disconnect
              </button>
            )}
            {importMessage && (
              <div className={`text-xs ${importMessage.startsWith('Error:') ? 'text-red-400' : 'text-gray-300'}`}>
                {importMessage}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-xs text-gray-400 uppercase">Garmin export</div>
            <p className="text-[11px] text-gray-500 mb-2">
              Import runs from a Garmin data export ZIP (DI_CONNECT/DI-Connect-Fitness only). Re-import is idempotent.
            </p>
            <input
              ref={garminZipInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                e.target.value = ''
                setImportMessage(null)
                try {
                  setImporting(true)
                  const { runs: normalizedRuns, stats } = await importGarminFromZipFile(file, targetKPS)
                  const existingGarmin = await db.runs.where('source').equals('garmin').toArray()
                  const existingIds = new Set((existingGarmin.map(r => r.external_id).filter(Boolean) as string[]))
                  const toAdd = normalizedRuns
                    .filter(r => !existingIds.has(r.external_id))
                    .map(n => convertGarminToRunRecord(n, safeUserProfile, targetKPS))
                    .filter((r): r is RunRecord => r !== null)
                  if (toAdd.length === 0) {
                    setImportMessage(`No new runs (${stats.duplicatesSkipped} duplicates skipped).`)
                    return
                  }
                  await db.runs.bulkAdd(toAdd)
                  await indexRunsAfterSave(toAdd, safeUserProfile)
                  setImportMessage(
                    `Imported ${toAdd.length} run${toAdd.length > 1 ? 's' : ''} from Garmin. ` +
                    `Files: ${stats.filesScanned}, running: ${stats.runningActivities}, skipped: ${stats.duplicatesSkipped}.`
                  )
                } catch (err) {
                  console.error('Garmin import error', err)
                  setImportMessage(`Error: ${err instanceof Error ? err.message : 'Garmin import failed'}.`)
                } finally {
                  setImporting(false)
                }
              }}
            />
            <button
              type="button"
              onClick={() => garminZipInputRef.current?.click()}
              className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-full transition"
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import Garmin ZIP'}
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-xs text-gray-400 uppercase">RAG (coach context)</div>
            <p className="text-[11px] text-gray-500 mb-2">
              New runs are synced to RAG automatically on app start. Use “Reindex all” only to repair or after clearing RAG.
            </p>
            <button
              type="button"
              onClick={async () => {
                setReindexMessage(null)
                try {
                  setReindexing(true)
                  const runs = await db.runs.orderBy('date').reverse().toArray()
                  if (runs.length === 0) {
                    setReindexMessage('No runs in the app. Import from Strava or Garmin first.')
                    return
                  }
                  const { indexed, errors } = await reindexAllRunsInRAG(runs, safeUserProfile)
                  setReindexMessage(
                    errors === 0
                      ? `Indexed ${indexed} runs in RAG.`
                      : `Indexed ${indexed} runs, ${errors} failed. Is the RAG service running?`
                  )
                } catch (err) {
                  setReindexMessage(`Error: ${err instanceof Error ? err.message : 'Reindex failed'}.`)
                } finally {
                  setReindexing(false)
                }
              }}
              className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-full transition"
              disabled={reindexing}
            >
              {reindexing ? 'Reindexing…' : 'Reindex all runs in RAG'}
            </button>
            {reindexMessage && (
              <div className="text-xs text-gray-300">{reindexMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
