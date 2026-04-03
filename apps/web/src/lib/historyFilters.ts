import type { RunRecord } from './database'

/** Filters apply to visible (non-deleted) runs. Pace is always sec/km (DB). */
export interface RunHistoryFilters {
  /** Case-insensitive substring match on `notes` (activity title / name for imports). */
  nameContains?: string
  /** Inclusive lower bound on averagePace (sec/km); excludes unrealistically fast paces (e.g. driving). */
  paceMinSecPerKm?: number
  /** Inclusive upper bound on averagePace (sec/km); excludes very slow rows if set. */
  paceMaxSecPerKm?: number
  durationMinSec?: number
  durationMaxSec?: number
  /** Distance bounds in meters */
  distanceMinM?: number
  distanceMaxM?: number
  /** Exact match on `source` (e.g. strava, garmin) */
  sourceEquals?: string
  /** Inclusive lower bound on relative KPS (same scale as list cards). Applied after sync filters; see `filterRunsByRelativeKpsBounds`. */
  kpsMin?: number
  /** Inclusive upper bound on relative KPS. */
  kpsMax?: number
}

export function defaultRunHistoryFilters(): RunHistoryFilters {
  return {}
}

export function hasActiveRunHistoryFilters(f: RunHistoryFilters): boolean {
  return (
    (f.nameContains?.trim() ?? '') !== '' ||
    f.paceMinSecPerKm != null ||
    f.paceMaxSecPerKm != null ||
    f.durationMinSec != null ||
    f.durationMaxSec != null ||
    f.distanceMinM != null ||
    f.distanceMaxM != null ||
    (f.sourceEquals?.trim() ?? '') !== '' ||
    f.kpsMin != null ||
    f.kpsMax != null
  )
}

/** True when History should run the async relative-KPS filter pass. */
export function hasKpsBoundsInFilters(f: RunHistoryFilters): boolean {
  return f.kpsMin != null || f.kpsMax != null
}

/**
 * Put the run matching `runId` at the front so it appears on page 1 (e.g. PB anchor after KPS range filter).
 * No-op if missing or already first. Compares ids with Number() for Dexie consistency.
 */
export function moveRunIdToFront(runs: RunRecord[], runId: number | null | undefined): RunRecord[] {
  if (runId == null) return runs
  const idx = runs.findIndex((r) => r.id != null && Number(r.id) === Number(runId))
  if (idx <= 0) return runs
  const next = [...runs]
  const [row] = next.splice(idx, 1)
  next.unshift(row)
  return next
}

export function runMatchesHistoryFilters(run: RunRecord, f: RunHistoryFilters): boolean {
  const q = f.nameContains?.trim()
  if (q) {
    const hay = (run.notes ?? '').toLowerCase()
    if (!hay.includes(q.toLowerCase())) return false
  }

  const p = run.averagePace
  if (f.paceMinSecPerKm != null && (!Number.isFinite(p) || p < f.paceMinSecPerKm)) return false
  if (f.paceMaxSecPerKm != null && (!Number.isFinite(p) || p > f.paceMaxSecPerKm)) return false

  if (f.durationMinSec != null && run.duration < f.durationMinSec) return false
  if (f.durationMaxSec != null && run.duration > f.durationMaxSec) return false

  if (f.distanceMinM != null && run.distance < f.distanceMinM) return false
  if (f.distanceMaxM != null && run.distance > f.distanceMaxM) return false

  const src = f.sourceEquals?.trim()
  if (src && (run.source ?? '').toLowerCase() !== src.toLowerCase()) return false

  return true
}

/** Page (1-based) containing first run on selected calendar day in a newest-first list. */
export function getPageForDateInDescendingList(
  selectedDateYmd: string,
  pageSize: number,
  descendingByDate: RunRecord[]
): number {
  if (descendingByDate.length === 0 || pageSize < 1) return 1
  const prefix = selectedDateYmd.length >= 10 ? selectedDateYmd.slice(0, 10) : selectedDateYmd
  const index = descendingByDate.findIndex((r) => r.date.slice(0, 10) === prefix)
  if (index < 0) return 1
  const totalPages = Math.ceil(descendingByDate.length / pageSize)
  const page = Math.floor(index / pageSize) + 1
  return Math.min(totalPages, Math.max(1, page))
}

/** Decimal minutes per km → sec/km */
export function minutesPerKmToSecPerKm(min: number): number {
  return min * 60
}

/** Decimal minutes per mile → sec/km (for filtering DB `averagePace`). */
export function minutesPerMiToSecPerKm(minPerMi: number): number {
  return (minPerMi * 60) / 1.609344
}

export interface RunHistoryFilterDraft {
  nameContains: string
  paceFastestMin: string
  paceSlowestMin: string
  durationMinMin: string
  durationMaxMin: string
  distanceMin: string
  distanceMax: string
  sourceEquals: string
  kpsMin: string
  kpsMax: string
}

export function emptyRunHistoryFilterDraft(): RunHistoryFilterDraft {
  return {
    nameContains: '',
    paceFastestMin: '',
    paceSlowestMin: '',
    durationMinMin: '',
    durationMaxMin: '',
    distanceMin: '',
    distanceMax: '',
    sourceEquals: '',
    kpsMin: '',
    kpsMax: '',
  }
}

function parsePositiveFloat(s: string): number | undefined {
  const v = parseFloat(s.trim())
  if (!Number.isFinite(v) || v < 0) return undefined
  return v
}

/**
 * Build applied filters from the filter form. Pace inputs are minutes per km or per mi depending on `paceUnit`.
 */
export function draftToRunHistoryFilters(
  d: RunHistoryFilterDraft,
  paceUnit: 'min/km' | 'min/mi'
): RunHistoryFilters {
  const f: RunHistoryFilters = {}
  if (d.nameContains.trim()) f.nameContains = d.nameContains.trim()
  if (d.sourceEquals.trim()) f.sourceEquals = d.sourceEquals.trim()

  const toSec = paceUnit === 'min/km' ? minutesPerKmToSecPerKm : minutesPerMiToSecPerKm
  const fastest = parsePositiveFloat(d.paceFastestMin)
  const slowest = parsePositiveFloat(d.paceSlowestMin)
  let paceMin = fastest != null ? toSec(fastest) : undefined
  let paceMax = slowest != null ? toSec(slowest) : undefined
  if (paceMin != null && paceMax != null && paceMin > paceMax) {
    const t = paceMin
    paceMin = paceMax
    paceMax = t
  }
  if (paceMin != null) f.paceMinSecPerKm = paceMin
  if (paceMax != null) f.paceMaxSecPerKm = paceMax

  const durMin = parsePositiveFloat(d.durationMinMin)
  const durMax = parsePositiveFloat(d.durationMaxMin)
  if (durMin != null) f.durationMinSec = durMin * 60
  if (durMax != null) f.durationMaxSec = durMax * 60
  if (
    f.durationMinSec != null &&
    f.durationMaxSec != null &&
    f.durationMinSec > f.durationMaxSec
  ) {
    const t = f.durationMinSec
    f.durationMinSec = f.durationMaxSec
    f.durationMaxSec = t
  }

  const distMin = parsePositiveFloat(d.distanceMin)
  const distMax = parsePositiveFloat(d.distanceMax)
  if (distMin != null) f.distanceMinM = distMin
  if (distMax != null) f.distanceMaxM = distMax
  if (
    f.distanceMinM != null &&
    f.distanceMaxM != null &&
    f.distanceMinM > f.distanceMaxM
  ) {
    const t = f.distanceMinM
    f.distanceMinM = f.distanceMaxM
    f.distanceMaxM = t
  }

  let kpsMin = parsePositiveFloat(d.kpsMin)
  let kpsMax = parsePositiveFloat(d.kpsMax)
  if (kpsMin != null && kpsMax != null && kpsMin > kpsMax) {
    const t = kpsMin
    kpsMin = kpsMax
    kpsMax = t
  }
  if (kpsMin != null) f.kpsMin = kpsMin
  if (kpsMax != null) f.kpsMax = kpsMax

  return f
}

/** Convert km or mi input to meters for distance filters. */
export function applyDistanceUnitToFilters(
  f: RunHistoryFilters,
  unitSystem: 'metric' | 'imperial'
): RunHistoryFilters {
  if (f.distanceMinM == null && f.distanceMaxM == null) return f
  const kmToM = 1000
  const miToM = 1609.344
  const mul = unitSystem === 'metric' ? kmToM : miToM
  const out: RunHistoryFilters = { ...f }
  if (out.distanceMinM != null) out.distanceMinM = out.distanceMinM * mul
  if (out.distanceMaxM != null) out.distanceMaxM = out.distanceMaxM * mul
  return out
}

/** Activity title for list cards (Strava/Garmin store name in `notes`). */
export function runDisplayTitle(run: { notes?: string | null }): string {
  const n = typeof run.notes === 'string' ? run.notes.trim() : ''
  if (n.length > 0) return n
  return 'Untitled run'
}
