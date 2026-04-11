import { useSettingsStore } from '../store/settingsStore'
import { KINETIX_PERFORMANCE_SCORE } from '../lib/branding'
import { fetchStravaActivities, convertStravaToRunRecord, getValidStravaToken } from '../lib/strava'
import { db, RunRecord, RUN_VISIBLE } from '../lib/database'
import { useState, useEffect, useRef } from 'react'
import { useStravaAuth } from '../hooks/useStravaAuth'
import { useWithingsAuth } from '../hooks/useWithingsAuth'
import { syncWithingsWeightsAtStartup, WITHINGS_WEIGHTS_SYNCED_EVENT } from '../lib/withings'
import { syncWithingsData } from '../lib/integrations/withings/sync'
import { evaluateWithingsSyncPolicy, isValidLocalTimeHHMM, normalizeSyncTimes } from '../lib/integrations/withings/syncPolicy'
import { runManualSyncOnce, shouldMarkScheduledSlotFulfilled } from '../lib/integrations/withings/manualSync'
import { importGarminFromZipFile, importGarminFromFitFile, isGarminFitFile } from '../lib/garminImport'
import { convertGarminToRunRecord } from '../lib/garmin'
import { indexRunsAfterSave, reindexAllRunsInRAG } from '../lib/ragClient'
import { useAuth } from '../components/providers/useAuth'
import { getProfileLabel, toKinetixUserProfile } from '../lib/kinetixProfile'
import { findOutlierRuns, calculateAbsoluteKPS } from '../lib/kpsUtils'
import { hideRun, bulkPutWeightEntries, getWeightHistoryCount, backfillRunWeights, type WeightEntry } from '../lib/database'
import { getProfileForRunDate } from '../lib/authState'
import { formatDistance, formatTime } from '@kinetix/core'
import { Dialog } from '../components/a11y/Dialog'
import { featureFlags } from '../lib/featureFlags'

export default function Settings() {
  const {
    targetKPS,
    setTargetKPS,
    beatPBPercent,
    setBeatPBPercent,
    beatRecentsCount,
    setBeatRecentsCount,
    unitSystem,
    setUnitSystem,
    physioMode,
    setPhysioMode,
    stravaToken,
    setStravaToken,
    stravaCredentials,
    setStravaCredentials,
    stravaSyncError,
    setStravaSyncError,
    weightSource,
    setWeightSource,
    withingsCredentials,
    setWithingsCredentials,
    lastWithingsWeightKg,
    setLastWithingsWeightKg,
    weightUnit,
    setWeightUnit,
    withingsExpandedSyncEnabled,
    setWithingsExpandedSyncEnabled,
    withingsSyncTimes,
    setWithingsSyncTimes,
    lastSuccessfulWithingsSyncAt,
    setLastSuccessfulWithingsSyncAt,
    lastSuccessfulWithingsScheduledSlotKey,
    setLastSuccessfulWithingsScheduledSlotKey,
  } = useSettingsStore()
  const { profile, session } = useAuth()
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [reindexing, setReindexing] = useState(false)
  const [reindexMessage, setReindexMessage] = useState<string | null>(null)
  const [outlierRuns, setOutlierRuns] = useState<RunRecord[] | null>(null)
  const garminZipInputRef = useRef<HTMLInputElement>(null)
  const { initiateOAuth, handleOAuthCallback } = useStravaAuth()
  const { initiateOAuth: initiateWithingsOAuth, handleOAuthCallback: handleWithingsCallback, disconnect: disconnectWithings } = useWithingsAuth()
  const [withingsRefreshing, setWithingsRefreshing] = useState(false)
  const [withingsExpandedSyncStatus, setWithingsExpandedSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failure'>('idle')
  const [withingsExpandedSyncMessage, setWithingsExpandedSyncMessage] = useState<string | null>(null)
  const [withingsSyncTimeErrors, setWithingsSyncTimeErrors] = useState<[string | null, string | null]>([null, null])
  const [weightHistoryCount, setWeightHistoryCount] = useState<number | null>(null)
  const [weightImporting, setWeightImporting] = useState(false)
  const [weightBackfilling, setWeightBackfilling] = useState(false)
  const weightHistoryFileRef = useRef<HTMLInputElement>(null)
  const withingsManualSyncGate = useRef({ inFlight: false })

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
        .then(() => {
          setImportMessage('Withings connected.')
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

  useEffect(() => {
    if (typeof indexedDB === 'undefined') return
    getWeightHistoryCount().then(setWeightHistoryCount)
  }, [])

  const handleWeightHistoryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setWeightImporting(true)
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      const arr = Array.isArray(raw) ? raw : []
      const entries: WeightEntry[] = arr
        .filter((x): x is { date?: string; dateUnix?: number; kg?: number } => x != null && typeof x === 'object')
        .map((x) => ({
          dateUnix: typeof x.dateUnix === 'number' ? x.dateUnix : parseInt(String(x.date ?? 0), 10) || 0,
          date: typeof x.date === 'string' ? x.date : new Date((x.dateUnix ?? 0) * 1000).toISOString(),
          kg: typeof x.kg === 'number' ? x.kg : 0,
        }))
        .filter((x) => x.dateUnix > 0 && x.kg > 0)
      const { count, latestKg } = await bulkPutWeightEntries(entries)
      if (latestKg != null) setLastWithingsWeightKg(latestKg)
      window.dispatchEvent(new CustomEvent(WITHINGS_WEIGHTS_SYNCED_EVENT))
      setImportMessage(`Imported ${count} weight entries into history. Latest: ${latestKg?.toFixed(1) ?? '—'} kg`)
      const newCount = await getWeightHistoryCount()
      setWeightHistoryCount(newCount)
    } catch (err) {
      setImportMessage(`Import failed: ${err instanceof Error ? err.message : 'Invalid file'}`)
    } finally {
      setWeightImporting(false)
    }
  }

  const profileLabel = profile ? getProfileLabel(profile, session?.user.email ?? null) : ''
  const expandedFeatureEnabled = featureFlags.ENABLE_WITHINGS_EXPANDED_INGESTION

  const scheduledDecision = evaluateWithingsSyncPolicy({
    now: new Date(),
    manual: false,
    featureEnabled: expandedFeatureEnabled,
    expandedSyncEnabled: withingsExpandedSyncEnabled,
    hasConnection: !!withingsCredentials,
    syncTimes: normalizeSyncTimes(withingsSyncTimes),
    lastSuccessfulScheduledSlotKey: lastSuccessfulWithingsScheduledSlotKey,
  })

  const handleWithingsSyncTimeChange = (index: 0 | 1, value: string) => {
    const next: [string, string] = [...withingsSyncTimes] as [string, string]
    next[index] = value
    const errors: [string | null, string | null] = [null, null]
    if (!isValidLocalTimeHHMM(next[0])) errors[0] = 'Use HH:MM'
    if (!isValidLocalTimeHHMM(next[1])) errors[1] = 'Use HH:MM'
    setWithingsSyncTimeErrors(errors)
    if (!errors[0] && !errors[1]) setWithingsSyncTimes(normalizeSyncTimes(next))
  }

  const handleManualExpandedWithingsSync = async () => {
    setWithingsExpandedSyncMessage(null)
    const decision = evaluateWithingsSyncPolicy({
      now: new Date(),
      manual: true,
      featureEnabled: expandedFeatureEnabled,
      expandedSyncEnabled: withingsExpandedSyncEnabled,
      hasConnection: !!withingsCredentials,
      syncTimes: normalizeSyncTimes(withingsSyncTimes),
      lastSuccessfulScheduledSlotKey: lastSuccessfulWithingsScheduledSlotKey,
    })
    if (!decision.shouldSync || !withingsCredentials) {
      setWithingsExpandedSyncStatus('failure')
      setWithingsExpandedSyncMessage(`Expanded sync blocked: ${decision.reason}`)
      return
    }

    setWithingsExpandedSyncStatus('syncing')
    const dueAtStart = evaluateWithingsSyncPolicy({
      now: new Date(),
      manual: false,
      featureEnabled: expandedFeatureEnabled,
      expandedSyncEnabled: withingsExpandedSyncEnabled,
      hasConnection: !!withingsCredentials,
      syncTimes: normalizeSyncTimes(withingsSyncTimes),
      lastSuccessfulScheduledSlotKey: lastSuccessfulWithingsScheduledSlotKey,
    })

    try {
      const wrapped = await runManualSyncOnce(withingsManualSyncGate.current, async () => {
        const result = await syncWithingsData(withingsCredentials)
        const nowIso = new Date().toISOString()
        setLastSuccessfulWithingsSyncAt(nowIso)
        const dueNow = evaluateWithingsSyncPolicy({
          now: new Date(),
          manual: false,
          featureEnabled: expandedFeatureEnabled,
          expandedSyncEnabled: withingsExpandedSyncEnabled,
          hasConnection: !!withingsCredentials,
          syncTimes: normalizeSyncTimes(withingsSyncTimes),
          lastSuccessfulScheduledSlotKey: lastSuccessfulWithingsScheduledSlotKey,
        })
        if (
          shouldMarkScheduledSlotFulfilled({
            syncSucceeded: true,
            dueReasonAtSyncStart: dueAtStart.reason,
            dueSlotKeyAtSyncStart: dueAtStart.scheduledSlotKey,
            dueSlotKeyAtSyncEnd: dueNow.scheduledSlotKey,
          })
        ) {
          setLastSuccessfulWithingsScheduledSlotKey(dueNow.scheduledSlotKey ?? null)
        }
        return result
      })
      if (!wrapped.started) {
        setWithingsExpandedSyncStatus('idle')
        return
      }
      const result = wrapped.result
      setWithingsExpandedSyncStatus('success')
      setWithingsExpandedSyncMessage(`Expanded sync complete (${result?.metricsWritten ?? 0} canonical metric row(s)).`)
    } catch (error) {
      setWithingsExpandedSyncStatus('failure')
      setWithingsExpandedSyncMessage(error instanceof Error ? error.message : 'Expanded sync failed')
    }
  }

  if (!profile) {
    return (
      <div className="pb-20 lg:pb-4">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <div className="glass rounded-2xl border border-yellow-500/30 p-6 space-y-2">
            <h1 className="text-lg font-bold text-yellow-300">Loading profile...</h1>
            <p className="text-sm text-slate-700 dark:text-gray-300">
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
      {outlierRuns != null && outlierRuns.length > 0 ? (
        <Dialog
          open
          onClose={() => setOutlierRuns(null)}
          ariaLabelledBy="outlier-title"
          ariaDescribedBy="outlier-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="glass rounded-2xl border border-amber-500/40 p-6 max-w-md w-full shadow-xl">
            <h2 id="outlier-title" className="text-lg font-bold text-amber-300 mb-2">Possible outliers</h2>
            <p id="outlier-desc" className="text-sm text-slate-700 dark:text-gray-300 mb-4">
              These runs have KPS &gt; 125% of your current PB and may be bad data (e.g. GPS glitch). Hide them so they don&apos;t affect your stats?
            </p>
            <ul className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {outlierRuns.map((run) => (
                <li key={run.id} className="text-xs text-slate-700 dark:text-gray-300 flex justify-between gap-2">
                  <span>{run.date ? new Date(run.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                  <span>{formatDistance(run.distance, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'}</span>
                  <span>{formatTime(run.duration)}</span>
                  <span className="text-amber-400 font-medium">KPS {Math.round(calculateAbsoluteKPS(run, safeUserProfile))}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setOutlierRuns(null)}
                className="px-4 py-2 rounded-lg border border-gray-600 text-slate-700 dark:text-gray-300 hover:bg-gray-800"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={async () => {
                  for (const run of outlierRuns) {
                    if (run.id) await hideRun(run.id)
                  }
                  setImportMessage(`${outlierRuns.length} run(s) hidden from stats (possible outliers).`)
                  setOutlierRuns(null)
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium"
              >
                Hide from stats
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
      <div className="max-w-md lg:max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <div className="glass rounded-2xl p-6 space-y-6">
          <div className="rounded-xl border border-white/10 bg-gray-900/30 p-3">
            <div className="text-xs text-slate-600 dark:text-gray-400 uppercase mb-1">Platform identity</div>
            <div className="text-sm text-white font-medium">{profileLabel}</div>
            <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">Profile ID: {profile.id}</div>
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
            <label className="block text-sm font-medium mb-2">Beat PB target %</label>
            <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-1">Used for &quot;Beat PB&quot; run suggestions on the Run view (e.g. 2 = beat PB by 2%).</p>
            <input
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              value={beatPBPercent}
              onChange={(e) => setBeatPBPercent(parseFloat(e.target.value) || 2)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Beat recents: last N runs</label>
            <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-1">Used for &quot;Beat recents&quot; on the Run view (best of last N runs, then beat by the % above).</p>
            <input
              type="number"
              min={2}
              max={50}
              value={beatRecentsCount}
              onChange={(e) => setBeatRecentsCount(parseInt(e.target.value, 10) || 10)}
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
              <div className="text-xs text-slate-600 dark:text-gray-400 uppercase">Withings (smart scale)</div>
              <p className="text-[11px] text-slate-500 dark:text-gray-500">
                Use your latest Withings scale weight for KPS. Weight refresh and expanded ingestion run only when explicitly triggered.
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
                          const { latestKg, historyEntriesSynced } = await syncWithingsWeightsAtStartup(
                            withingsCredentials,
                            setWithingsCredentials
                          )
                          if (latestKg != null) {
                            setLastWithingsWeightKg(latestKg)
                            setWeightSource('withings')
                          }
                          window.dispatchEvent(new CustomEvent(WITHINGS_WEIGHTS_SYNCED_EVENT))
                          setImportMessage(
                            latestKg != null
                              ? `Weight updated: ${latestKg.toFixed(1)} kg (${historyEntriesSynced} row(s) merged).`
                              : 'No weight data from Withings.'
                          )
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
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-700 dark:text-gray-300">Expanded Withings sync</label>
                      <button
                        type="button"
                        disabled={!expandedFeatureEnabled}
                        onClick={() => setWithingsExpandedSyncEnabled(!withingsExpandedSyncEnabled)}
                        aria-label="Toggle expanded Withings sync"
                        aria-pressed={withingsExpandedSyncEnabled}
                        className={`w-11 h-6 rounded-full transition ${withingsExpandedSyncEnabled ? 'bg-cyan-500' : 'bg-gray-700'} disabled:opacity-50`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-all ${withingsExpandedSyncEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-500">
                      Local schedule (HH:MM): sync is due once per slot. Default slots are 08:00 and 20:00.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-600 dark:text-gray-400">Morning</label>
                        <input
                          type="time"
                          value={withingsSyncTimes[0]}
                          disabled={!expandedFeatureEnabled}
                          onChange={(e) => handleWithingsSyncTimeChange(0, e.target.value)}
                          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-2 py-1 text-xs disabled:opacity-50"
                        />
                        {withingsSyncTimeErrors[0] && <p className="text-[11px] text-red-400">{withingsSyncTimeErrors[0]}</p>}
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 dark:text-gray-400">Evening</label>
                        <input
                          type="time"
                          value={withingsSyncTimes[1]}
                          disabled={!expandedFeatureEnabled}
                          onChange={(e) => handleWithingsSyncTimeChange(1, e.target.value)}
                          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-2 py-1 text-xs disabled:opacity-50"
                        />
                        {withingsSyncTimeErrors[1] && <p className="text-[11px] text-red-400">{withingsSyncTimeErrors[1]}</p>}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-gray-400">
                      Status: {withingsExpandedSyncStatus}
                      {scheduledDecision.reason === 'scheduled_due' && scheduledDecision.scheduledTime
                        ? ` • Scheduled due now (${scheduledDecision.scheduledTime})`
                        : null}
                      {scheduledDecision.reason === 'not_due' && scheduledDecision.nextEligibleAt
                        ? ` • Next eligible ${new Date(scheduledDecision.nextEligibleAt).toLocaleString()}`
                        : null}
                    </div>
                    {lastSuccessfulWithingsSyncAt && (
                      <p className="text-[11px] text-green-400">Last expanded sync: {new Date(lastSuccessfulWithingsSyncAt).toLocaleString()}</p>
                    )}
                    {withingsExpandedSyncMessage && (
                      <p className={`text-[11px] ${withingsExpandedSyncStatus === 'failure' ? 'text-red-400' : 'text-slate-700 dark:text-gray-300'}`}>
                        {withingsExpandedSyncMessage}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={withingsExpandedSyncStatus === 'syncing'}
                      onClick={handleManualExpandedWithingsSync}
                      className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-full transition disabled:opacity-50"
                    >
                      {withingsExpandedSyncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}
                    </button>
                    {!expandedFeatureEnabled && (
                      <p className="text-[11px] text-amber-400">Feature flag disabled: expanded ingestion controls are read-only.</p>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <input
                      ref={weightHistoryFileRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={handleWeightHistoryFile}
                    />
                    <button
                      type="button"
                      disabled={weightImporting}
                      onClick={() => weightHistoryFileRef.current?.click()}
                      className="bg-cyan-500/80 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-full transition disabled:opacity-50"
                    >
                      {weightImporting ? 'Importing…' : 'Import weight history (JSON)'}
                    </button>
                    {weightHistoryCount != null && (
                      <p className="text-[11px] text-slate-600 dark:text-gray-400 mt-1">Weight history: {weightHistoryCount} entries</p>
                    )}
                    <button
                      type="button"
                      disabled={weightBackfilling || (weightHistoryCount ?? 0) === 0}
                      onClick={async () => {
                        setWeightBackfilling(true)
                        setImportMessage(null)
                        try {
                          const { updated, skipped } = await backfillRunWeights()
                          setImportMessage(
                            `Backfill done: ${updated} run(s) updated with weight, ${skipped} skipped (already had weight or no match).`
                          )
                        } catch (e) {
                          setImportMessage(`Backfill failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
                        } finally {
                          setWeightBackfilling(false)
                        }
                      }}
                      className="ml-2 bg-cyan-500/60 hover:bg-cyan-500/80 text-white text-xs font-bold px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {weightBackfilling ? 'Backfilling…' : 'Backfill run weights'}
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

          <div>
            <label className="block text-sm font-medium mb-2">Weight display unit</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="weightUnit"
                  checked={weightUnit === 'kg'}
                  onChange={() => setWeightUnit('kg')}
                  className="rounded"
                />
                <span className="text-sm">kg</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="weightUnit"
                  checked={weightUnit === 'lbs'}
                  onChange={() => setWeightUnit('lbs')}
                  className="rounded"
                />
                <span className="text-sm">lbs</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-gray-500 mt-1">Used in Weight History and run details.</p>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Physio-Pacer Mode</label>
            <button
              type="button"
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
                <div className="text-xs text-slate-600 dark:text-gray-400 uppercase">Strava Sync</div>
                <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-2">
                  Connect your Strava account to import your running history.
                </p>
                {!stravaCredentials && !stravaToken?.trim() ? (
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
                    const token = await getValidStravaToken()
                    if (!token) {
                      setImportMessage('Connect Strava first or refresh your token.')
                      return
                    }
                    const activities = await fetchStravaActivities(token)
                    
                    if (activities.length === 0) {
                      setImportMessage('No running activities found in your Strava history.')
                      return
                    }

                    // Check for duplicates by comparing date and distance
                    const existingRuns = (await db.runs.where('source').equals('strava').toArray()).filter(
                      (r) => (r.deleted ?? 0) === RUN_VISIBLE
                    )
                    const existingKeys = new Set(
                      existingRuns.map(run => `${run.date}-${Math.round(run.distance)}`)
                    )

                    const records = (
                      await Promise.all(
                        activities.map(async (activity) => {
                          const profileForDate = await getProfileForRunDate(activity.start_date)
                          return convertStravaToRunRecord(activity, profileForDate, targetKPS)
                        })
                      )
                    )
                      .filter((record): record is RunRecord => record !== null)
                      .filter((record) => {
                        const key = `${record.date}-${Math.round(record.distance)}`
                        return !existingKeys.has(key)
                      })

                    if (records.length === 0) {
                      setImportMessage('All activities are already imported.')
                      return
                    }

                    const added: RunRecord[] = []
                    for (const r of records) {
                      const id = await db.runs.add(r)
                      added.push({ ...r, id: id as number } as RunRecord)
                    }
                    await indexRunsAfterSave(added)
                    setImportMessage(`Imported ${added.length} new run${added.length > 1 ? 's' : ''} from Strava.`)
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('kinetix:runSaved'))
                    }
                    const outliers = await findOutlierRuns(added)
                    if (outliers.length > 0) setOutlierRuns(outliers)
                  } catch (error) {
                    console.error('Strava import error', error)
                    const errorMsg = error instanceof Error ? error.message : 'Failed to import from Strava. Check token.'
                    setImportMessage(`Error: ${errorMsg}`)
                    const isAuthErr = String(errorMsg).includes('401') || String(errorMsg).toLowerCase().includes('unauthorized')
                    if (isAuthErr) {
                      setStravaCredentials(null)
                      setStravaToken('')
                      setStravaSyncError('Token expired. Disconnect and reconnect Strava.')
                    }
                  } finally {
                    setImporting(false)
                  }
                }}
                className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-full transition"
                disabled={importing || (!stravaCredentials && !stravaToken?.trim())}
              >
                {importing ? 'Importing…' : 'Import from Strava'}
              </button>
            </div>
            <input
              type="password"
              value={stravaToken}
              onChange={(e) => setStravaToken(e.target.value)}
              placeholder={(stravaCredentials || stravaToken) ? 'Connected via OAuth' : 'Or paste token manually'}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-sm"
              disabled={!!stravaCredentials}
            />
            {(stravaCredentials || stravaToken) && (
              <button
                onClick={() => {
                  setStravaCredentials(null)
                  setStravaToken('')
                  setStravaSyncError(null)
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Disconnect
              </button>
            )}
            {stravaSyncError && (
              <div className="text-xs text-amber-400">
                Startup sync: {stravaSyncError}
                {stravaSyncError.includes('expired') || stravaSyncError.includes('reconnect') ? (
                  <span className="block mt-1">Click Disconnect above, then Connect with Strava to fix.</span>
                ) : null}
              </div>
            )}
            {importMessage && (
              <div className={`text-xs ${importMessage.startsWith('Error:') ? 'text-red-400' : 'text-slate-700 dark:text-gray-300'}`}>
                {importMessage}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-xs text-slate-600 dark:text-gray-400 uppercase">Garmin export</div>
            <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-2">
              Upload a <strong className="text-slate-600 dark:text-gray-400">full Garmin account export</strong> ZIP (
              <code className="text-slate-600 dark:text-gray-400">DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json</code>
              ), a ZIP that contains <code className="text-slate-600 dark:text-gray-400">.fit</code> files, or a single running activity{' '}
              <code className="text-slate-600 dark:text-gray-400">.fit</code> file. Re-import is idempotent.
            </p>
            <input
              ref={garminZipInputRef}
              type="file"
              accept=".zip,.fit,.FIT"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                e.target.value = ''
                setImportMessage(null)
                try {
                  setImporting(true)
                  const { runs: normalizedRuns, stats } = isGarminFitFile(file)
                    ? await importGarminFromFitFile(file, targetKPS)
                    : await importGarminFromZipFile(file, targetKPS)
                  const existingGarmin = (await db.runs.where('source').equals('garmin').toArray()).filter(
                    (r) => (r.deleted ?? 0) === RUN_VISIBLE
                  )
                  const existingIds = new Set((existingGarmin.map(r => r.external_id).filter(Boolean) as string[]))
                  const toAdd = (
                    await Promise.all(
                      normalizedRuns
                        .filter((r) => !existingIds.has(r.external_id))
                        .map(async (n) => convertGarminToRunRecord(n, await getProfileForRunDate(n.date), targetKPS))
                    )
                  ).filter((r): r is RunRecord => r !== null)
                  if (toAdd.length === 0) {
                    const noJson = stats.filesScanned === 0
                    const noFit = stats.fitFilesScanned === 0
                    if (noJson && noFit) {
                      setImportMessage(
                        'No supported Garmin data found. Use a ZIP with DI_CONNECT/.../summarizedActivities.json and/or .fit files, or pick a single running .fit file.'
                      )
                    } else if (normalizedRuns.length === 0) {
                      setImportMessage(
                        'No running activities found in this file (only non-running sports or empty sessions).'
                      )
                    } else {
                      setImportMessage(`No new runs (${stats.duplicatesSkipped} duplicates skipped).`)
                    }
                    return
                  }
                  const added: RunRecord[] = []
                  for (const r of toAdd) {
                    const id = await db.runs.add(r)
                    added.push({ ...r, id: id as number } as RunRecord)
                  }
                  await indexRunsAfterSave(added)
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('kinetix:runSaved'))
                  }
                  setImportMessage(
                    `Imported ${added.length} run${added.length > 1 ? 's' : ''} from Garmin. ` +
                      `JSON files: ${stats.filesScanned}, FIT files: ${stats.fitFilesScanned}, running sessions: ${stats.runningActivities}, duplicates skipped: ${stats.duplicatesSkipped}.`
                  )
                  const outliers = await findOutlierRuns(added)
                  if (outliers.length > 0) setOutlierRuns(outliers)
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
              {importing ? 'Importing…' : 'Import Garmin (ZIP or .fit)'}
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-xs text-slate-600 dark:text-gray-400 uppercase">RAG (coach context)</div>
            <p className="text-[11px] text-slate-500 dark:text-gray-500 mb-2">
              New runs are synced to RAG automatically on app start. Use “Reindex all” only to repair or after clearing RAG.
            </p>
            <button
              type="button"
              onClick={async () => {
                setReindexMessage(null)
                try {
                  setReindexing(true)
                  const runs = await db.runs.orderBy('date').reverse().filter((r) => (r.deleted ?? 0) === RUN_VISIBLE).toArray()
                  if (runs.length === 0) {
                    setReindexMessage('No runs in the app. Import from Strava or Garmin first.')
                    return
                  }
                  const { indexed, errors } = await reindexAllRunsInRAG(runs)
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
              <div className="text-xs text-slate-700 dark:text-gray-300">{reindexMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
