/**
 * RAG index client for apps/web. Maps RunRecord to the format expected by
 * apps/rag service (avgPace, avgKPS, etc.) and indexes after save.
 */

import type { RunRecord } from './database'
import type { UserProfile } from '@kinetix/core'
import { calculateAbsoluteKPS } from './kpsUtils'
import { getProfileForRun } from './authState'

const RAG_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010]
let cachedRAGBaseUrl: string | null = null

/** Resolve RAG base URL: use VITE_RAG_SERVICE_URL if set, else try localhost ports 3001..3010 until /health responds. */
async function getRAGBaseUrl(): Promise<string | null> {
  const explicit = import.meta.env.VITE_RAG_SERVICE_URL
  if (explicit && typeof explicit === 'string') return explicit
  if (cachedRAGBaseUrl) return cachedRAGBaseUrl
  for (const port of RAG_PORTS) {
    const base = `http://localhost:${port}`
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) })
      if (res.ok) {
        cachedRAGBaseUrl = base
        return base
      }
    } catch {
      /* try next port */
    }
  }
  return null
}

/** Run shape expected by apps/rag EmbeddingService and VectorDB */
export interface RAGRunShape {
  id: string | number
  date: string
  distance: number
  duration: number
  avgPace: number
  avgKPS: number
  avgHeartRate: number | null
  avgCadence: number | null
  formScore: number | null
}

/**
 * Map a RunRecord to the RAG service run shape (id, avgPace, avgKPS, etc.).
 */
export function runRecordToRAGRun(run: RunRecord, userProfile: UserProfile): RAGRunShape {
  const id = run.id ?? run.external_id ?? `run-${run.date}-${run.distance}`
  return {
    id: typeof id === 'number' ? id : id,
    date: run.date,
    distance: run.distance,
    duration: run.duration,
    avgPace: run.averagePace,
    avgKPS: calculateAbsoluteKPS(run, userProfile),
    avgHeartRate: run.heartRate ?? null,
    avgCadence: null,
    formScore: null,
  }
}

/**
 * Index a single run in the RAG service. No-op if service unavailable.
 */
export async function indexRunInRAG(ragRun: RAGRunShape): Promise<boolean> {
  try {
    const base = await getRAGBaseUrl()
    if (!base) return false
    const res = await fetch(`${base}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run: ragRun }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * After saving runs (live, Strava, or Garmin), index them in RAG. Best-effort.
 * Uses weight-at-run-date for KPS so historical runs are indexed with correct KPS.
 */
export async function indexRunsAfterSave(runs: RunRecord[]): Promise<void> {
  const available = await checkRAGAvailable()
  if (!available || runs.length === 0) return
  for (const run of runs) {
    const profile = await getProfileForRun(run)
    const ragRun = runRecordToRAGRun(run, profile)
    await indexRunInRAG(ragRun)
  }
}

async function checkRAGAvailable(): Promise<boolean> {
  const base = await getRAGBaseUrl()
  return base !== null
}

/**
 * Fetch the set of run ids already indexed in RAG. Returns empty set if service unavailable.
 */
export async function getIndexedRunIds(): Promise<Set<string>> {
  try {
    const base = await getRAGBaseUrl()
    if (!base) return new Set()
    const res = await fetch(`${base}/indexed-ids`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return new Set()
    const data = (await res.json()) as { ids?: string[] }
    const ids = Array.isArray(data.ids) ? data.ids : []
    return new Set(ids.map((id) => String(id)))
  } catch {
    return new Set()
  }
}

function runToRagId(run: RunRecord): string {
  const id = run.id ?? run.external_id ?? `run-${run.date}-${run.distance}`
  return String(id)
}

/**
 * Sync only runs that are not yet in RAG (differential). Use as the main "Sync" action.
 */
export async function syncNewRunsToRAG(
  runs: RunRecord[],
  userProfile: UserProfile
): Promise<{ indexed: number; errors: number; skipped: number }> {
  const base = await getRAGBaseUrl()
  if (!base) return { indexed: 0, errors: runs.length, skipped: 0 }
  const indexedIds = await getIndexedRunIds()
  const toIndex = runs.filter((run) => !indexedIds.has(runToRagId(run)))
  let indexed = 0
  let errors = 0
  for (const run of toIndex) {
    const ragRun = runRecordToRAGRun(run, userProfile)
    const ok = await indexRunInRAG(ragRun)
    if (ok) indexed += 1
    else errors += 1
  }
  const skipped = runs.length - toIndex.length
  return { indexed, errors, skipped }
}

const FALLBACK_CONTEXT =
  "RAG unavailable. No run data. Give general advice only. Do not invent NPI or pace from the user's runs."

/**
 * Get coach context from RAG for a user message (retrieval + pace-to-beat).
 * Used by the coach chat so the agent receives run data from RAG.
 */
export async function getCoachContext(
  message: string,
  userProfile?: UserProfile | null,
  pbRun?: RunRecord | null
): Promise<string> {
  try {
    const body: {
      message: string
      userProfile?: UserProfile
      pbRun?: { distance: number; duration: number; averagePace?: number; avgKPS?: number; kps?: number }
    } = { message }
    if (userProfile) body.userProfile = userProfile
    if (pbRun && pbRun.distance && pbRun.duration) {
      const pbAvgKPS = userProfile ? calculateAbsoluteKPS(pbRun, userProfile) : undefined
      body.pbRun = {
        distance: pbRun.distance,
        duration: pbRun.duration,
        averagePace: pbRun.averagePace,
        avgKPS: pbAvgKPS,
        kps: pbAvgKPS,
      }
    }
    const base = await getRAGBaseUrl()
    if (!base) return FALLBACK_CONTEXT
    const res = await fetch(`${base}/coach-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return FALLBACK_CONTEXT
    const data = (await res.json()) as { context?: string }
    return typeof data.context === 'string' ? data.context : FALLBACK_CONTEXT
  } catch {
    return FALLBACK_CONTEXT
  }
}

/**
 * Reindex all runs into RAG. Use after initial setup or to fix missing indexes.
 * Uses weight at run date for each run's KPS.
 */
export async function reindexAllRunsInRAG(runs: RunRecord[]): Promise<{ indexed: number; errors: number }> {
  let indexed = 0
  let errors = 0
  const base = await getRAGBaseUrl()
  if (!base) return { indexed: 0, errors: runs.length }
  for (const run of runs) {
    const profile = await getProfileForRun(run)
    const ragRun = runRecordToRAGRun(run, profile)
    const ok = await indexRunInRAG(ragRun)
    if (ok) indexed += 1
    else errors += 1
  }
  return { indexed, errors }
}
