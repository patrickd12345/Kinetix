import { useCallback, useEffect, useMemo, useState } from 'react'
import { featureFlags } from '../lib/featureFlags'
import { evaluateWithingsSyncPolicy, normalizeSyncTimes, type WithingsSyncDecision, type WithingsSyncReason } from '../lib/integrations/withings/syncPolicy'
import { useSettingsStore } from '../store/settingsStore'

export interface WithingsSyncPromptState {
  isDue: boolean
  reason: WithingsSyncReason
  scheduledTime?: string
  scheduledSlotKey?: string
  nextEligibleAt?: string
  connectionExists: boolean
  expandedEnabled: boolean
  startupInFlight: boolean
}

function evaluatePromptPolicy(now: Date, state: ReturnType<typeof useSettingsStore.getState>): WithingsSyncPromptState {
  const decision: WithingsSyncDecision = evaluateWithingsSyncPolicy({
    now,
    manual: false,
    featureEnabled: featureFlags.ENABLE_WITHINGS_EXPANDED_INGESTION,
    expandedSyncEnabled: state.withingsExpandedSyncEnabled,
    hasConnection: !!state.withingsCredentials,
    syncTimes: normalizeSyncTimes(state.withingsSyncTimes),
    lastSuccessfulScheduledSlotKey: state.lastSuccessfulWithingsScheduledSlotKey,
  })

  return {
    isDue: decision.reason === 'scheduled_due' && decision.shouldSync,
    reason: decision.reason,
    scheduledTime: decision.scheduledTime,
    scheduledSlotKey: decision.scheduledSlotKey,
    nextEligibleAt: decision.nextEligibleAt,
    connectionExists: !!state.withingsCredentials,
    expandedEnabled: state.withingsExpandedSyncEnabled,
    startupInFlight: state.withingsStartupSyncInFlight,
  }
}

export function useWithingsSyncPrompt(): WithingsSyncPromptState {
  const {
    withingsCredentials,
    withingsExpandedSyncEnabled,
    withingsSyncTimes,
    lastSuccessfulWithingsScheduledSlotKey,
    withingsStartupSyncInFlight,
  } = useSettingsStore()
  const [now, setNow] = useState(() => new Date())

  const refresh = useCallback(() => {
    setNow(new Date())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onFocus = () => refresh()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  return useMemo(
    () =>
      evaluatePromptPolicy(now, {
        ...useSettingsStore.getState(),
        withingsCredentials,
        withingsExpandedSyncEnabled,
        withingsSyncTimes,
        lastSuccessfulWithingsScheduledSlotKey,
        withingsStartupSyncInFlight,
      }),
    [
      now,
      withingsCredentials,
      withingsExpandedSyncEnabled,
      withingsSyncTimes,
      lastSuccessfulWithingsScheduledSlotKey,
      withingsStartupSyncInFlight,
    ]
  )
}
