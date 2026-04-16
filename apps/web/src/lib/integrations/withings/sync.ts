import {
  appendProviderRawEvents,
  appendProviderSyncRun,
  getProviderSyncCheckpoint,
  putCanonicalHealthMetrics,
  setProviderSyncCheckpoint,
  upsertProviderConnectionState,
} from '../../database'
import { EMPTY_WITHINGS_CAPABILITIES, deriveCapabilitiesFromMetrics, mergeCapabilities } from './capabilityMap'
import { syncActivity } from './syncActivity'
import { syncHeart } from './syncHeart'
import { syncMeasures } from './syncMeasures'
import { syncSleep } from './syncSleep'
import { syncWorkouts } from './syncWorkouts'
import type {
  WithingsAuthCredentials,
  WithingsCapabilityMap,
  WithingsCursor,
  WithingsSyncDomainResult,
  WithingsSyncResult,
  WithingsSyncRun,
} from './types'

function mergeCursor(base: WithingsCursor, patch?: Partial<WithingsCursor>): WithingsCursor {
  return { ...base, ...(patch ?? {}) }
}

function emptyCounts(): WithingsSyncRun['counts'] {
  return { body: 0, activity: 0, workout: 0, sleep: 0, heart: 0, blood_pressure: 0 }
}

function countMetrics(results: WithingsSyncDomainResult[]): WithingsSyncRun['counts'] {
  const counts = emptyCounts()
  for (const result of results) {
    for (const metric of result.metrics) counts[metric.family] += 1
  }
  return counts
}

export async function syncWithingsData(credentials: WithingsAuthCredentials): Promise<WithingsSyncResult> {
  const startedAt = new Date().toISOString()
  const runId = `withings-run:${credentials.userId}:${startedAt}`
  const checkpointBefore = await getProviderSyncCheckpoint(credentials.userId, 'withings')
  const domainResults: WithingsSyncDomainResult[] = []

  const domains = [
    () => syncMeasures(credentials, checkpointBefore.lastMeasureUpdate),
    () => syncActivity(credentials, checkpointBefore.lastActivityDate),
    () => syncWorkouts(credentials, checkpointBefore.lastWorkoutDate),
    () => syncSleep(credentials, checkpointBefore.lastSleepDate),
    () => syncHeart(credentials, checkpointBefore.lastMeasureUpdate),
  ]

  const errors: string[] = []
  let checkpointAfter = { ...checkpointBefore }

  for (const runDomain of domains) {
    try {
      const result = await runDomain()
      domainResults.push(result)
      checkpointAfter = mergeCursor(checkpointAfter, result.checkpointPatch)
      if (result.errors?.length) errors.push(...result.errors)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown domain sync failure')
    }
  }

  const rawEvents = domainResults.flatMap((r) => r.rawEvents)
  const metrics = domainResults.flatMap((r) => r.metrics)
  const capabilitiesByMetric: WithingsCapabilityMap = deriveCapabilitiesFromMetrics(metrics)
  const capabilities = mergeCapabilities(capabilitiesByMetric, domainResults)

  await appendProviderRawEvents(rawEvents)
  await putCanonicalHealthMetrics(metrics)
  await setProviderSyncCheckpoint(credentials.userId, 'withings', checkpointAfter)
  await upsertProviderConnectionState({
    id: `withings:${credentials.userId}`,
    userId: credentials.userId,
    provider: 'withings',
    connected: true,
    updatedAt: new Date().toISOString(),
    capabilities,
  })

  const finishedAt = new Date().toISOString()
  const run: WithingsSyncRun = {
    id: runId,
    userId: credentials.userId,
    provider: 'withings',
    startedAt,
    finishedAt,
    status: errors.length === 0 ? 'success' : metrics.length > 0 ? 'partial' : 'failed',
    checkpointBefore,
    checkpointAfter,
    counts: countMetrics(domainResults),
    errors,
  }

  await appendProviderSyncRun(run)

  return {
    run,
    capabilities: metrics.length > 0 ? capabilities : EMPTY_WITHINGS_CAPABILITIES,
    metricsWritten: metrics.length,
  }
}
