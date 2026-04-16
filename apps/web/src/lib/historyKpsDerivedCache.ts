import type { PBRecord, RunRecord } from './database'
import { resolveProfileForRunWithWeightCache } from './authState'
import { calculateAbsoluteKPS, calculateRelativeKPSSync, isValidKPS } from './kpsUtils'
import { computeKpsMedalsForRuns, type KpsMedal } from './kpsMedals'

const STORAGE_VERSION = 1 as const
const STORAGE_PREFIX = 'kinetix.historyKpsDerived.v1:'

/**
 * Session + optional localStorage cache for History-derived KPS (relative scores + medals).
 *
 * Relative KPS for a run is a pure function of: PB anchor, per-run facts, weight-at-date inputs,
 * and display profile settings. When the tier key is unchanged, we can reuse cached relative
 * values for runs whose per-run signature is unchanged — only new/edited runs need recomputation.
 * When PB changes (new best, cleared PB, or PB snapshot row changes), the tier key changes and
 * the cache resets.
 */
let cachedTierKey: string | null = null
const runRelativeCache = new Map<number, { rel: number; sig: string }>()

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

export function clearHistoryKpsDerivedCache(): void {
  cachedTierKey = null
  runRelativeCache.clear()
}

/** Removes persisted History KPS snapshot for one user (e.g. sign-out). */
export function clearHistoryKpsDerivedStorage(userId: string | null): void {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    // ignore
  }
}

export function hydrateHistoryKpsDerivedFromStorage(userId: string | null, tierKey: string): boolean {
  if (!userId || typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return false
    const parsed = JSON.parse(raw) as { v?: number; tierKey?: string; entries?: [number, number, string][] }
    if (parsed.v !== STORAGE_VERSION || parsed.tierKey !== tierKey || !Array.isArray(parsed.entries)) {
      return false
    }
    runRelativeCache.clear()
    for (const row of parsed.entries) {
      if (!Array.isArray(row) || row.length !== 3) continue
      const [id, rel, sig] = row
      if (typeof id !== 'number' || typeof rel !== 'number' || typeof sig !== 'string') continue
      runRelativeCache.set(id, { rel, sig })
    }
    cachedTierKey = tierKey
    return true
  } catch {
    return false
  }
}

export function persistHistoryKpsDerivedToStorage(userId: string | null, tierKey: string): void {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    const entries: [number, number, string][] = []
    runRelativeCache.forEach((v, id) => entries.push([id, v.rel, v.sig]))
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ v: STORAGE_VERSION, tierKey, entries }),
    )
  } catch {
    // quota or private mode
  }
}

function runInputsSig(run: RunRecord, weightAtDateKg: number | undefined): string {
  return [
    run.date,
    run.distance,
    run.duration,
    run.averagePace,
    run.targetKPS,
    run.weightKg ?? '',
    weightAtDateKg ?? '',
  ].join(':')
}

/**
 * Stable key for "everything that affects relative KPS except per-run facts / weight-at-date".
 */
export function buildHistoryKpsTierKey(args: {
  pb: PBRecord | null
  weightSource: string
  lastWithingsWeightKg: number
  physioMode: boolean
  profileAge: number | undefined
  profileWeightKg: number | undefined
}): string {
  const pbPart = args.pb
    ? `${args.pb.runId}:${args.pb.achievedAt}:${args.pb.profileSnapshot.age}:${args.pb.profileSnapshot.weightKg}`
    : 'none'
  return [
    pbPart,
    args.weightSource,
    String(args.lastWithingsWeightKg),
    args.physioMode ? '1' : '0',
    String(args.profileAge ?? ''),
    String(args.profileWeightKg ?? ''),
  ].join('|')
}

export function computeHistoryKpsDerived(args: {
  tierKey: string
  userId: string | null
  medalSourceRuns: RunRecord[]
  itemIds: Set<number>
  weightByRunDate: Map<string, number>
  pb: PBRecord | null
  pbRun: RunRecord | null
}): {
  medalKpsMap: Map<number, number>
  kpsMap: Map<number, number>
  invalidKPS: number
  medalByRunId: Map<number, KpsMedal>
} {
  const { tierKey, userId, medalSourceRuns, itemIds, weightByRunDate, pb, pbRun } = args

  if (cachedTierKey !== tierKey) {
    const hydrated = hydrateHistoryKpsDerivedFromStorage(userId, tierKey)
    if (!hydrated) {
      runRelativeCache.clear()
      cachedTierKey = tierKey
    }
  }

  const medalKpsMap = new Map<number, number>()
  const kpsMap = new Map<number, number>()
  let invalidKPS = 0
  const currentIds = new Set<number>()

  for (const run of medalSourceRuns) {
    if (run.id == null) continue
    const id = run.id
    currentIds.add(id)

    const wAt = weightByRunDate.get(run.date)
    const sig = runInputsSig(run, wAt)
    const prev = runRelativeCache.get(id)

    let relative: number
    if (prev && prev.sig === sig) {
      relative = prev.rel
    } else {
      const resolvedProfile = resolveProfileForRunWithWeightCache(weightByRunDate, run)
      const calculatedKPS = calculateAbsoluteKPS(run, resolvedProfile)
      if (itemIds.has(id) && !isValidKPS(calculatedKPS)) {
        invalidKPS += 1
      }
      relative = calculateRelativeKPSSync(run, resolvedProfile, pb, pbRun)
      runRelativeCache.set(id, { rel: relative, sig })
    }

    medalKpsMap.set(id, relative)
    if (itemIds.has(id)) {
      kpsMap.set(id, relative)
    }
  }

  for (const id of runRelativeCache.keys()) {
    if (!currentIds.has(id)) {
      runRelativeCache.delete(id)
    }
  }

  const medalByRunId = computeKpsMedalsForRuns(medalSourceRuns, medalKpsMap)

  persistHistoryKpsDerivedToStorage(userId, tierKey)

  return { medalKpsMap, kpsMap, invalidKPS, medalByRunId }
}
