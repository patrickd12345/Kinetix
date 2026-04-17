import { db, RunRecord, PBRecord, RUN_VISIBLE, getWeightsForDates } from './database'
import { UserProfile, calculateKPS } from '@kinetix/core'
import { resolveProfileForRunWithWeightCache } from './authState'

/**
 * KPS UTILITIES - ARCHITECTURAL INVARIANTS
 *
 * NON-NEGOTIABLE RULES:
 *
 * 0. AGE-WEIGHT-GRADED (FOUNDATIONAL - NEVER DEVIATE)
 *    - KPS is ALWAYS age-weight graded. This is the essence of KPS.
 *    - Every KPS display, comparison, chart, or ranking MUST use calculateAbsoluteKPS(run, profile)
 *    - Profile MUST include age and weight (via getProfileForRun / getProfileForRunDate).
 *    - KPS is DERIVED at runtime and MUST NOT be persisted as authoritative run data.
 *    - Any legacy run.kps field is non-authoritative and MUST NOT be used for display/comparison.
 *    - No exception. No negotiation. Non-negotiable for all future development.
 *
 * 1. PB IS A FACT, NOT A CALCULATION
 *    - PB is stored explicitly (runId + profile snapshot)
 *    - PB only changes when a strictly better run occurs
 *
 * 2. PB = 100, ALL OTHERS ARE RATIOS (NON-NEGOTIABLE)
 *    - The all-time PB run ALWAYS has KPS = 100. By definition.
 *    - Any other run's displayed KPS is a RATIO of that PB: (run_absolute / pb_absolute) * 100
 *    - No heuristic, scan, or comparison may override this
 *    - Use calculateRelativeKPS / calculateRelativeKPSSync for display; never raw absolute KPS
 *
 * 3. KPS STORAGE RULE
 *    - Runs store only raw facts: distance, duration, date
 *    - Absolute/relative KPS is a DERIVED VIEW
 *    - PB stores the profile snapshot used when it was set
 *    - Historical PBs are not rewritten when profile changes
 *
 * 5. WEIGHT-AT-RUN-DATE RULE
 *    - KPS for a run MUST use the user's weight at the time of that run (from weight history).
 *    - Callers use getProfileForRunDate(run.date) so historical runs are not distorted by today's weight.
 *
 * 4. FORBIDDEN BEHAVIOR
 *    - Using run.kps for display, comparison, charts, or ranking (violates rule 0)
 *    - Displaying raw absolute KPS to users instead of relative KPS (violates rule 2)
 *    - Any function that "finds" a baseline by scanning runs
 *    - Any logic that reorders PB based on recalculated KPS
 *    - Any date-based or ID-based hacks
 *    - Any hybrid logic mixing stored and recalculated KPS
 *
 * PB INITIALIZATION:
 * - PB anchor is the lifetime best absolute KPS run (age-weight graded)
 * - Derived from visible runs using profile-at-run-date
 * - Reconciled by ensurePBInitialized() so PB=100 remains globally consistent
 */

/** Minimum distance (m) and duration (s) for a run to be treated as meaningful for KPS. Filters GPS glitches / accidental recordings. */
export const MIN_RUN_DISTANCE_M = 200
export const MIN_RUN_DURATION_S = 60

/**
 * Validate that a run has valid data for KPS calculation
 */
export function isValidRunForKPS(run: { distance: number; duration: number }): boolean {
  return (
    run.distance > 0 &&
    run.duration > 0 &&
    !isNaN(run.distance) &&
    !isNaN(run.duration) &&
    isFinite(run.distance) &&
    isFinite(run.duration)
  )
}

/**
 * True if the run is long enough to produce a meaningful KPS (avoids huge chart spikes from 0.01 km / 3s junk).
 */
export function isMeaningfulRunForKPS(run: { distance: number; duration: number }): boolean {
  return (
    isValidRunForKPS(run) &&
    run.distance >= MIN_RUN_DISTANCE_M &&
    run.duration >= MIN_RUN_DURATION_S
  )
}

/**
 * Validate that a KPS value is valid
 */
export function isValidKPS(kps: number): boolean {
  return kps > 0 && !isNaN(kps) && isFinite(kps)
}

/**
 * Calculate absolute KPS for a run using a specific user profile
 * This is a pure function - no side effects, no storage
 */
export function calculateAbsoluteKPS(run: RunRecord, userProfile: UserProfile): number {
  if (!isValidRunForKPS(run)) {
    return 0
  }

  const absoluteKPS = calculateKPS(
    { distanceKm: run.distance / 1000, timeSeconds: run.duration },
    userProfile
  )

  return isValidKPS(absoluteKPS) ? absoluteKPS : 0
}

/** KPS above this ratio of current PB is considered a suspicious outlier on import (e.g. bad data). */
const OUTLIER_KPS_RATIO = 1.25

/**
 * From a list of runs (e.g. newly imported), return those whose absolute KPS is above 125% of the
 * current PB. Uses weight at run date for each run's KPS. Returns [] if no PB or no run has an id.
 */
export async function findOutlierRuns(runs: RunRecord[]): Promise<RunRecord[]> {
  const pb = await getPB()
  if (!pb) return []
  const pbRun = await db.runs.get(pb.runId)
  if (!pbRun || (pbRun.deleted ?? 0) !== RUN_VISIBLE) return []
  const pbAbsoluteKPS = calculateAbsoluteKPS(pbRun, pb.profileSnapshot)
  if (!isValidKPS(pbAbsoluteKPS)) return []
  const threshold = pbAbsoluteKPS * OUTLIER_KPS_RATIO
  const result: RunRecord[] = []

  const runDates = runs.filter((r) => !!r.id).map((r) => r.date)
  const weightByDate = await getWeightsForDates(runDates)

  for (const r of runs) {
    if (!r.id) continue
    const profileForRun = resolveProfileForRunWithWeightCache(weightByDate, r)
    const kps = calculateAbsoluteKPS(r, profileForRun)
    if (isValidKPS(kps) && kps > threshold) result.push(r)
  }
  return result
}

/**
 * Get the stored PB record
 * Returns null if no PB has been set yet
 *
 * INVARIANT: This is the ONLY source of truth for PB
 */
export async function getPB(): Promise<PBRecord | null> {
  const pbRecords = await db.pb.toArray()
  if (pbRecords.length === 0) {
    return null
  }

  // Should only be one PB record - return the most recent if multiple exist
  const pb = pbRecords.sort((a, b) =>
    new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()
  )[0]

  return pb
}

/**
 * Get the PB run record
 * Returns null if no PB has been set, the PB run doesn't exist, or the run is logically deleted.
 */
export async function getPBRun(): Promise<RunRecord | null> {
  const pb = await getPB()
  if (!pb || !pb.runId) {
    return null
  }

  const run = await db.runs.get(pb.runId)
  if (!run || (run.deleted ?? 0) !== RUN_VISIBLE) return null
  return run
}

/**
 * Ensure PB exists before any user-facing relative KPS display.
 * Uses historical seeding first, then legacy fallback selection when needed.
 */
export async function ensurePBInitialized(currentProfile?: UserProfile): Promise<void> {
  void currentProfile // retained for call-site compatibility

  const allRuns = (await db.runs.toArray()).filter(
    (r) => (r.deleted ?? 0) === RUN_VISIBLE && !!r.id
  )
  if (allRuns.length === 0) return

  let bestRun: RunRecord | null = null
  let bestProfile: UserProfile | null = null
  let bestAbsolute = 0

  const runDates = allRuns.filter((r) => !!r.id).map((r) => r.date)
  const weightByDate = await getWeightsForDates(runDates)

  for (const run of allRuns) {
    const profileForRun = resolveProfileForRunWithWeightCache(weightByDate, run)
    const abs = calculateAbsoluteKPS(run, profileForRun)
    if (isValidKPS(abs) && abs > bestAbsolute) {
      bestAbsolute = abs
      bestRun = run
      bestProfile = profileForRun
    }
  }

  if (!bestRun?.id || !bestProfile) return

  const existing = await getPB()
  if (!existing) {
    await db.pb.add({
      runId: bestRun.id,
      achievedAt: bestRun.date,
      profileSnapshot: bestProfile,
    })
    return
  }

  if (
    existing.runId !== bestRun.id ||
    existing.achievedAt !== bestRun.date ||
    existing.profileSnapshot.age !== bestProfile.age ||
    existing.profileSnapshot.weightKg !== bestProfile.weightKg
  ) {
    await db.pb.update(existing.id!, {
      runId: bestRun.id,
      achievedAt: bestRun.date,
      profileSnapshot: bestProfile,
    })
  }
}

/**
 * Calculate relative KPS for a run
 *
 * INVARIANT: PB run ALWAYS returns 100, by definition
 *
 * Formula:
 * - If run.id === pb.runId → return 100 immediately
 * - Otherwise:
 *   relativeKPS = (calculateAbsoluteKPS(run, currentProfile) / calculateAbsoluteKPS(pb.run, pb.profileSnapshot)) * 100
 *
 * @param run - The run to calculate relative KPS for
 * @param currentProfile - Current user profile for calculating the run's absolute KPS
 * @returns Relative KPS (PB = 100)
 */
export async function calculateRelativeKPS(
  run: RunRecord,
  currentProfile: UserProfile
): Promise<number> {
  await ensurePBInitialized(currentProfile)

  // Calculate absolute KPS for this run using current profile
  const runAbsoluteKPS = calculateAbsoluteKPS(run, currentProfile)

  if (!isValidKPS(runAbsoluteKPS)) {
    return 0
  }

  // Get PB record
  const pb = await getPB()
  if (!pb) {
    // Strict invariant mode: no PB means no valid relative KPS scale.
    return 0
  }

  // Get PB run (ignore if logically deleted)
  const pbRun = await db.runs.get(pb.runId)
  if (!pbRun || (pbRun.deleted ?? 0) !== RUN_VISIBLE) {
    return 0
  }

  // INVARIANT: PB run always returns 100, by definition
  if (run.id != null && pb.runId != null && Number(run.id) === Number(pb.runId)) {
    return 100
  }

  // Calculate PB absolute KPS using the profile snapshot from when PB was set
  const pbAbsoluteKPS = calculateAbsoluteKPS(pbRun, pb.profileSnapshot)

  if (!isValidKPS(pbAbsoluteKPS)) {
    return 0
  }

  // Calculate relative KPS
  const relativeKPS = (runAbsoluteKPS / pbAbsoluteKPS) * 100

  if (isNaN(relativeKPS) || !isFinite(relativeKPS)) {
    return 0
  }

  return relativeKPS
}

/**
 * Sync variant: compute relative KPS when PB and PB run are already loaded.
 * Use in batch (e.g. History page) to avoid N+1 getPB/getPBRun calls.
 */
export function calculateRelativeKPSSync(
  run: RunRecord,
  currentProfile: UserProfile,
  pb: PBRecord | null,
  pbRun: RunRecord | null
): number {
  if (!pb || !pbRun) return 0

  // PB anchor is always relative 100 (invariant) — must not be blocked by absolute-KPS validation.
  const sameAsPb =
    run.id != null && pb.runId != null && Number(run.id) === Number(pb.runId)
  if (sameAsPb) return 100

  const runAbsoluteKPS = calculateAbsoluteKPS(run, currentProfile)
  if (!isValidKPS(runAbsoluteKPS)) return 0
  const pbAbsoluteKPS = calculateAbsoluteKPS(pbRun, pb.profileSnapshot)
  if (!isValidKPS(pbAbsoluteKPS)) return 0
  const relativeKPS = (runAbsoluteKPS / pbAbsoluteKPS) * 100
  if (isNaN(relativeKPS) || !isFinite(relativeKPS)) return 0
  return relativeKPS
}

/**
 * Keep runs whose relative KPS (same as list cards) falls in optional inclusive bounds.
 * When any bound is set, runs with non-finite relative scores are excluded.
 */
export async function filterRunsByRelativeKpsBounds(
  runs: RunRecord[],
  kpsMin: number | undefined,
  kpsMax: number | undefined
): Promise<RunRecord[]> {
  if (kpsMin == null && kpsMax == null) return runs

  const pb = await getPB()
  let pbRun = pb ? (await db.runs.get(pb.runId)) ?? null : null
  if (pbRun && (pbRun.deleted ?? 0) !== RUN_VISIBLE) pbRun = null

  const runDates = runs.filter((r) => !!r.id).map((r) => r.date)
  const weightByDate = await getWeightsForDates(runDates)

  const out: RunRecord[] = []
  for (const run of runs) {
    const profileForRun = resolveProfileForRunWithWeightCache(weightByDate, run)
    const rel = calculateRelativeKPSSync(run, profileForRun, pb ?? null, pbRun ?? null)
    if (!Number.isFinite(rel)) continue
    // Match History list cards, which use Math.round(relativeKPS) for display.
    const displayRel = Math.round(rel)
    if (kpsMin != null && displayRel < kpsMin) continue
    if (kpsMax != null && displayRel > kpsMax) continue
    out.push(run)
  }
  return out
}

/**
 * Check if a new run beats the current PB and update PB if so
 *
 * INVARIANT: PB only changes when a strictly better run occurs
 * Comparison uses current profile for new run vs PB profile snapshot for PB run
 *
 * @param newRun - The new run to check
 * @param currentProfile - Current user profile
 * @returns true if PB was updated, false otherwise
 */
export async function checkAndUpdatePB(
  newRun: RunRecord,
  currentProfile: UserProfile
): Promise<boolean> {
  if (!newRun.id) {
    return false // Can't set PB for unsaved run
  }

  const newRunAbsoluteKPS = calculateAbsoluteKPS(newRun, currentProfile)
  if (!isValidKPS(newRunAbsoluteKPS)) {
    return false // Invalid KPS, can't be PB
  }

  const pb = await getPB()

  if (!pb) {
    // No PB exists - this is automatically the PB
    await db.pb.add({
      runId: newRun.id,
      achievedAt: newRun.date,
      profileSnapshot: currentProfile,
    })
    return true
  }

  // Get PB run (treat deleted as missing so a new PB can be set)
  const pbRun = await db.runs.get(pb.runId)
  if (!pbRun || (pbRun.deleted ?? 0) !== RUN_VISIBLE) {
    await db.pb.update(pb.id!, {
      runId: newRun.id,
      achievedAt: newRun.date,
      profileSnapshot: currentProfile,
    })
    return true
  }

  // Calculate PB absolute KPS using profile snapshot from when PB was set
  const pbAbsoluteKPS = calculateAbsoluteKPS(pbRun, pb.profileSnapshot)

  if (!isValidKPS(pbAbsoluteKPS)) {
    // Invalid PB - set new run as PB
    await db.pb.update(pb.id!, {
      runId: newRun.id,
      achievedAt: newRun.date,
      profileSnapshot: currentProfile,
    })
    return true
  }

  // Check if new run beats PB (strictly better)
  if (newRunAbsoluteKPS > pbAbsoluteKPS) {
    // New PB!
    await db.pb.update(pb.id!, {
      runId: newRun.id,
      achievedAt: newRun.date,
      profileSnapshot: currentProfile,
    })
    return true
  }

  return false // Not a new PB
}

/**
 * Legacy entrypoint retained for compatibility.
 * PB is now derived from lifetime-best run via ensurePBInitialized().
 */
export async function seedInitialPB(currentProfile: UserProfile): Promise<void> {
  await ensurePBInitialized(currentProfile)
}

/**
 * Initialize/reconcile PB from existing runs.
 * @deprecated Use ensurePBInitialized() directly.
 */
export async function initializePBFromExistingRuns(currentProfile: UserProfile): Promise<void> {
  await ensurePBInitialized(currentProfile)
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use calculateRelativeKPS instead
 */
export async function getRelativeKPS(
  run: RunRecord,
  userProfile: UserProfile,
  _baselineRun?: RunRecord | null
): Promise<number> {
  return calculateRelativeKPS(run, userProfile)
}
