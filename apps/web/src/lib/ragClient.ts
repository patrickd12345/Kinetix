/**
 * RAG index client for apps/web. Maps RunRecord to the format expected by
 * apps/rag service (avgPace, avgKPS, etc.) and indexes after save.
 */

import type { RunRecord } from './database'
import type { UserProfile } from '@kinetix/core'
import { calculateAbsoluteKPS } from './kpsUtils'

const RAG_SERVICE_URL = import.meta.env.VITE_RAG_SERVICE_URL ?? 'http://localhost:3001'

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
    avgKPS: calculateAbsoluteKPS(run, userProfile) || run.kps,
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
    const res = await fetch(`${RAG_SERVICE_URL}/index`, {
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
 */
export async function indexRunsAfterSave(
  runs: RunRecord[],
  userProfile: UserProfile
): Promise<void> {
  const available = await checkRAGAvailable()
  if (!available || runs.length === 0) return
  for (const run of runs) {
    const ragRun = runRecordToRAGRun(run, userProfile)
    await indexRunInRAG(ragRun)
  }
}

async function checkRAGAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${RAG_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
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
      body.pbRun = {
        distance: pbRun.distance,
        duration: pbRun.duration,
        averagePace: pbRun.averagePace,
        avgKPS: pbRun.kps,
        kps: pbRun.kps,
      }
    }
    const res = await fetch(`${RAG_SERVICE_URL}/coach-context`, {
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
