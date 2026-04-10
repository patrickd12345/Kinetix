import { useMemo, useRef, useState } from 'react'
import { syncWithingsData } from '../lib/integrations/withings/sync'
import { evaluateWithingsSyncPolicy, normalizeSyncTimes } from '../lib/integrations/withings/syncPolicy'
import { runManualSyncOnce, shouldMarkScheduledSlotFulfilled } from '../lib/integrations/withings/manualSync'
import { useSettingsStore } from '../store/settingsStore'
import { featureFlags } from '../lib/featureFlags'
import { useWithingsSyncPrompt } from '../hooks/useWithingsSyncPrompt'

export default function WithingsSyncPrompt() {
  const prompt = useWithingsSyncPrompt()
  const [dismissed, setDismissed] = useState(false)
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'failure'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const gateRef = useRef({ inFlight: false })

  const {
    withingsCredentials,
    withingsExpandedSyncEnabled,
    withingsSyncTimes,
    lastSuccessfulWithingsScheduledSlotKey,
    setLastSuccessfulWithingsScheduledSlotKey,
    setLastSuccessfulWithingsSyncAt,
    lastSuccessfulWithingsSyncAt,
  } = useSettingsStore()

  const subtitle = useMemo(() => {
    if (!lastSuccessfulWithingsSyncAt) return 'Last sync: never'
    return `Last sync: ${new Date(lastSuccessfulWithingsSyncAt).toLocaleString()}`
  }, [lastSuccessfulWithingsSyncAt])

  const shouldRender = !dismissed && prompt.expandedEnabled && prompt.connectionExists && prompt.isDue

  if (!shouldRender) return null

  const handleSyncNow = async () => {
    setMessage(null)
    if (!withingsCredentials) {
      setStatus('failure')
      setMessage('Withings is not connected.')
      return
    }

    const dueAtStart = evaluateWithingsSyncPolicy({
      now: new Date(),
      manual: false,
      featureEnabled: featureFlags.ENABLE_WITHINGS_EXPANDED_INGESTION,
      expandedSyncEnabled: withingsExpandedSyncEnabled,
      hasConnection: !!withingsCredentials,
      syncTimes: normalizeSyncTimes(withingsSyncTimes),
      lastSuccessfulScheduledSlotKey: lastSuccessfulWithingsScheduledSlotKey,
    })

    setStatus('syncing')
    try {
      const wrapped = await runManualSyncOnce(gateRef.current, async () => syncWithingsData(withingsCredentials))
      if (!wrapped.started) return

      const nowIso = new Date().toISOString()
      setLastSuccessfulWithingsSyncAt(nowIso)

      const dueAtEnd = evaluateWithingsSyncPolicy({
        now: new Date(),
        manual: false,
        featureEnabled: featureFlags.ENABLE_WITHINGS_EXPANDED_INGESTION,
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
          dueSlotKeyAtSyncEnd: dueAtEnd.scheduledSlotKey,
        })
      ) {
        setLastSuccessfulWithingsScheduledSlotKey(dueAtStart.scheduledSlotKey ?? null)
      }

      setStatus('success')
      setMessage(`Sync complete (${wrapped.result?.metricsWritten ?? 0} metric row(s)).`)
    } catch (error) {
      setStatus('failure')
      setMessage(error instanceof Error ? error.message : 'Sync failed')
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3" aria-live="polite">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">Withings sync due</h2>
          <p className="text-xs text-[var(--shell-text-secondary)] dark:text-[var(--shell-text-secondary)]">{subtitle}</p>
          {message && (
            <p className={`text-xs ${status === 'failure' ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{message}</p>
          )}
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => void handleSyncNow()}
            disabled={status === 'syncing'}
            className="shell-focus-ring shell-disabled rounded-md border border-cyan-600/50 px-3 py-1.5 text-xs font-medium text-cyan-900 hover:bg-cyan-500/10 dark:text-cyan-100"
          >
            {status === 'syncing' ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shell-focus-ring rounded-md px-2 py-1 text-xs text-[var(--shell-text-tertiary)] hover:bg-slate-200/60 dark:text-[var(--shell-text-secondary)] dark:hover:bg-white/10"
            aria-label="Dismiss withings sync prompt"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  )
}
