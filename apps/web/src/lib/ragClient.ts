/**
 * RAG index client for apps/web. Maps RunRecord to the format expected by
 * apps/rag service (avgPace, avgKPS, etc.) and indexes after save.
 */

import type {
  CoachGuardrailPayload,
  Provenance,
  UserProfile,
  VerifiedFactContract,
} from '@kinetix/core'
import { extractNumericTokensFromText } from '@kinetix/core'
import { getWeightsForDates, type RunRecord } from './database'
import { calculateAbsoluteKPS } from './kpsUtils'
import { resolveProfileForRunWithWeightCache } from './authState'

const RAG_PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010]
let cachedRAGBaseUrl: string | null = null

/** Clears the resolved localhost cache (e.g. env switch or RAG restarted on another port). */
export function clearRagBaseUrlCache(): void {
  cachedRAGBaseUrl = null
}

/** Resolve RAG base URL: use VITE_RAG_SERVICE_URL if set, else try localhost ports 3001..3010 until /health responds. */
export async function getRAGBaseUrl(): Promise<string | null> {
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
  songTitle?: string | null
  songArtist?: string | null
  songBpm?: number | null
}

export interface CoachContextBundle {
  context: string
  contract: VerifiedFactContract
}

export type CoachUnitSystem = 'metric' | 'imperial'

const FALLBACK_CONTEXT =
  "RAG unavailable. No run data. Give general advice only. Do not invent NPI or pace from the user's runs."

const DEFAULT_ALLOWED_OUTPUT_MODES: VerifiedFactContract['allowedOutputModes'] = [
  'explanation',
  'comparison',
  'coaching_summary',
  'motivation',
  'insufficient_data',
  'verified_math',
]

const DEFAULT_FORBIDDEN_OPERATIONS: VerifiedFactContract['forbiddenOperations'] = [
  'invent_numbers',
  'introduce_new_numeric_value',
  'derive_new_numeric_target',
  'modify_verified_values',
  'infer_missing_inputs',
  'medical_diagnosis',
  'unsupported_prediction',
  'future_performance_prediction',
  'physiological_claim',
  'injury_prediction',
  'training_effect_prediction',
  'performance_ranking_claim',
  'trend_claim',
  'improvement_claim',
  'regression_claim',
]

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
    songTitle: run.songTitle ?? null,
    songArtist: run.songArtist ?? null,
    songBpm: run.songBpm ?? null,
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

  const runDates = runs.map((r) => r.date)
  const weightByDate = await getWeightsForDates(runDates)

  for (const run of runs) {
    const profile = resolveProfileForRunWithWeightCache(weightByDate, run)
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
  if (!base) {
    /** No RAG endpoint (no env / no local service): defer sync — do not count as per-run index failures. */
    return { indexed: 0, errors: 0, skipped: runs.length }
  }
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

function createFallbackCoachContext(unitSystem: CoachUnitSystem): CoachContextBundle {
  return {
    context: FALLBACK_CONTEXT,
    contract: {
      verifiedFacts: {
        unitSystem,
        dataAvailability: {
          hasRetrievedRuns: false,
          hasPbTargets: false,
        },
        retrievedRunCount: 0,
        retrievedRuns: [],
        pbPaceToBeat: null,
      },
      userStatedFacts: {},
      allowedOutputModes: DEFAULT_ALLOWED_OUTPUT_MODES,
      forbiddenOperations: DEFAULT_FORBIDDEN_OPERATIONS,
      provenance: [
        {
          kind: 'verified_fact',
          source: 'coach-context:fallback',
          path: 'verifiedFacts.dataAvailability',
        },
      ],
    },
  }
}

function extractGoalFact(message: string): string | undefined {
  const goalMatch =
    message.match(/\bgoal\s+(?:is|=)\s+([^.!?\n]+)/i) ??
    message.match(/\b(?:training for|trying to|want to|aiming to)\s+([^.!?\n]+)/i) ??
    message.match(/\bimprove\s+([^.!?\n]+)/i)

  const value = goalMatch?.[1]?.trim()
  return value ? value.replace(/\s+/g, ' ') : undefined
}

export function buildCoachGuardrailPayload(
  message: string,
  contract: VerifiedFactContract,
): CoachGuardrailPayload {
  const numericMentions = extractNumericTokensFromText(message)
  const goal = extractGoalFact(message)
  const userStatedFacts: Record<string, unknown> = { numericMentions }
  const provenance: Provenance[] = [...contract.provenance]

  provenance.push({
    kind: 'user_input',
    source: 'chat-message',
    path: 'userStatedFacts.numericMentions',
  })

  if (goal) {
    userStatedFacts.goal = goal
    provenance.push({
      kind: 'user_input',
      source: 'chat-message',
      path: 'userStatedFacts.goal',
    })
  }

  return {
    mode: 'coach',
    templateHint: 'auto',
    contract: {
      ...contract,
      userStatedFacts: {
        ...contract.userStatedFacts,
        ...userStatedFacts,
      },
      provenance,
    },
  }
}

/**
 * Get coach context from RAG for a user message (retrieval + pace-to-beat).
 * Used by the coach chat so the agent receives run data from RAG.
 */
export async function getCoachContext(
  message: string,
  userProfile?: UserProfile | null,
  pbRun?: RunRecord | null,
  unitSystem: CoachUnitSystem = 'metric',
): Promise<CoachContextBundle> {
  try {
    const body: {
      message: string
      unitSystem?: CoachUnitSystem
      userProfile?: UserProfile
      pbRun?: { distance: number; duration: number; averagePace?: number; avgKPS?: number; kps?: number }
    } = { message, unitSystem }
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
    if (!base) return createFallbackCoachContext(unitSystem)
    const res = await fetch(`${base}/coach-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return createFallbackCoachContext(unitSystem)
    const data = (await res.json()) as { context?: string; contract?: VerifiedFactContract }
    if (typeof data.context !== 'string' || !data.contract || typeof data.contract !== 'object') {
      return createFallbackCoachContext(unitSystem)
    }
    return {
      context: data.context,
      contract: data.contract,
    }
  } catch {
    return createFallbackCoachContext(unitSystem)
  }
}

/**
 * Reindex all runs into RAG. Use after initial setup or to fix missing indexes.
 * Uses weight at run date for each run's KPS.
 */
export async function reindexAllRunsInRAG(runs: RunRecord[]): Promise<{
  indexed: number
  errors: number
  /** True when no RAG URL could be resolved (not the same as per-run index failures). */
  noRagService: boolean
}> {
  let indexed = 0
  let errors = 0
  const base = await getRAGBaseUrl()
  if (!base) return { indexed: 0, errors: 0, noRagService: true }

  const runDates = runs.map((r) => r.date)
  const weightByDate = await getWeightsForDates(runDates)

  for (const run of runs) {
    const profile = resolveProfileForRunWithWeightCache(weightByDate, run)
    const ragRun = runRecordToRAGRun(run, profile)
    const ok = await indexRunInRAG(ragRun)
    if (ok) indexed += 1
    else errors += 1
  }
  return { indexed, errors, noRagService: false }
}
