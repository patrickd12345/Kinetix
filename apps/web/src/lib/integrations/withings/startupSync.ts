import { featureFlags } from '../../featureFlags'
import { syncWithingsWeightsAtStartup, WITHINGS_WEIGHTS_SYNCED_EVENT } from '../../withings'
import type { WithingsCredentials } from '../../../store/settingsStore'
import { syncWithingsData } from './sync'
import { evaluateWithingsSyncPolicy, normalizeSyncTimes } from './syncPolicy'
import { shouldMarkScheduledSlotFulfilled } from './manualSync'

export interface WithingsStartupSyncState {
  withingsCredentials: WithingsCredentials | null
  withingsExpandedSyncEnabled: boolean
  withingsSyncTimes: [string, string]
  lastSuccessfulWithingsScheduledSlotKey: string | null
  lastSuccessfulWithingsStartupSyncDate: string | null
}

export interface WithingsStartupSyncActions {
  setWithingsCredentials: (creds: WithingsCredentials | null) => void
  setLastWithingsWeightKg: (kg: number) => void
  setLastSuccessfulWithingsSyncAt: (iso: string | null) => void
  setLastSuccessfulWithingsScheduledSlotKey: (slotKey: string | null) => void
  setLastSuccessfulWithingsStartupSyncDate: (dateKey: string | null) => void
  dispatchWeightsSynced?: () => void
}

export interface WithingsStartupSyncResult {
  started: boolean
  skippedReason?: 'missing_connection' | 'already_synced_today'
  expandedSyncRan: boolean
  historyEntriesSynced: number
  latestKg: number | null
}

export function getWithingsStartupDateKey(now: Date): string {
  const yyyy = now.getFullYear()
  const mm = `${now.getMonth() + 1}`.padStart(2, '0')
  const dd = `${now.getDate()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function dispatchDefaultWeightsSynced() {
  window.dispatchEvent(new CustomEvent(WITHINGS_WEIGHTS_SYNCED_EVENT))
}

export async function runWithingsStartupReload(
  state: WithingsStartupSyncState,
  actions: WithingsStartupSyncActions,
  now: Date = new Date(),
  featureEnabled: boolean = featureFlags.ENABLE_WITHINGS_EXPANDED_INGESTION
): Promise<WithingsStartupSyncResult> {
  const dateKey = getWithingsStartupDateKey(now)
  if (!state.withingsCredentials) {
    return { started: false, skippedReason: 'missing_connection', expandedSyncRan: false, historyEntriesSynced: 0, latestKg: null }
  }

  /** First successful startup pass today sets this; later opens the same day still refresh weight below. */
  const alreadySyncedToday = state.lastSuccessfulWithingsStartupSyncDate === dateKey

  const dueAtStart = evaluateWithingsSyncPolicy({
    now,
    manual: false,
    featureEnabled,
    expandedSyncEnabled: state.withingsExpandedSyncEnabled,
    hasConnection: true,
    syncTimes: normalizeSyncTimes(state.withingsSyncTimes),
    lastSuccessfulScheduledSlotKey: state.lastSuccessfulWithingsScheduledSlotKey,
  })

  let expandedSyncRan = false
  if (!alreadySyncedToday && dueAtStart.shouldSync && dueAtStart.reason === 'scheduled_due') {
    try {
      await syncWithingsData(state.withingsCredentials)
      expandedSyncRan = true
      const nowIso = now.toISOString()
      actions.setLastSuccessfulWithingsSyncAt(nowIso)

      const dueAtEnd = evaluateWithingsSyncPolicy({
        now,
        manual: false,
        featureEnabled,
        expandedSyncEnabled: state.withingsExpandedSyncEnabled,
        hasConnection: true,
        syncTimes: normalizeSyncTimes(state.withingsSyncTimes),
        lastSuccessfulScheduledSlotKey: state.lastSuccessfulWithingsScheduledSlotKey,
      })

      if (
        shouldMarkScheduledSlotFulfilled({
          syncSucceeded: true,
          dueReasonAtSyncStart: dueAtStart.reason,
          dueSlotKeyAtSyncStart: dueAtStart.scheduledSlotKey,
          dueSlotKeyAtSyncEnd: dueAtEnd.scheduledSlotKey,
        })
      ) {
        actions.setLastSuccessfulWithingsScheduledSlotKey(dueAtStart.scheduledSlotKey ?? null)
      }
    } catch {
      // Expanded ingestion is best-effort; always attempt Measure API weight refresh for KPS.
    }
  }

  const weightResult = await syncWithingsWeightsAtStartup(
    state.withingsCredentials,
    actions.setWithingsCredentials
  )
  if (weightResult.latestKg != null) actions.setLastWithingsWeightKg(weightResult.latestKg)
  ;(actions.dispatchWeightsSynced ?? dispatchDefaultWeightsSynced)()
  if (!alreadySyncedToday) {
    actions.setLastSuccessfulWithingsStartupSyncDate(dateKey)
  }

  return {
    started: true,
    expandedSyncRan,
    historyEntriesSynced: weightResult.historyEntriesSynced,
    latestKg: weightResult.latestKg,
  }
}
