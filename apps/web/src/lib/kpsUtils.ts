import { db, RunRecord, PBRecord } from './database'
import { UserProfile, calculateKPS } from '@kinetix/core'

/**
 * KPS UTILITIES - ARCHITECTURAL INVARIANTS
 *
 * NON-NEGOTIABLE RULES:
 *
 * 1. PB IS A FACT, NOT A CALCULATION
 *    - PB is stored explicitly (runId + profile snapshot)
 *    - PB is NEVER rediscovered by scanning runs
 *    - PB only changes when a strictly better run occurs
 *
 * 2. BASELINE RULE
 *    - The PB run ALWAYS displays KPS = 100
 *    - This is by definition, not by calculation
 *    - No heuristic, scan, or comparison may override this
 *
 * 3. KPS STORAGE RULE
 *    - Runs store only raw facts: distance, duration, date
 *    - Absolute/relative KPS is a DERIVED VIEW
 *    - PB stores the profile snapshot used when it was set
 *    - Historical PBs are not rewritten when profile changes
 *
 * 4. FORBIDDEN BEHAVIOR
 *    - Any function that "finds" a baseline by scanning runs
 *    - Any logic that reorders PB based on recalculated KPS
 *    - Any date-based or ID-based hacks
 *    - Any hybrid logic mixing stored and recalculated KPS
 *
 * HISTORICAL INITIALIZATION:
 * - The run from 2025-09-30 is declared as the initial PB
 * - This is seeded via seedInitialPB() function
 * - Seeding is idempotent and only runs once
 */

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
 * Returns null if no PB has been set or if the PB run doesn't exist
 */
export async function getPBRun(): Promise<RunRecord | null> {
  const pb = await getPB()
  if (!pb || !pb.runId) {
    return null
  }

  const run = await db.runs.get(pb.runId)
  return run || null
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
  // Calculate absolute KPS for this run using current profile
  const runAbsoluteKPS = calculateAbsoluteKPS(run, currentProfile)

  if (!isValidKPS(runAbsoluteKPS)) {
    return 0
  }

  // Get PB record
  const pb = await getPB()
  if (!pb) {
    // No PB set yet - return absolute KPS
    return runAbsoluteKPS
  }

  // Get PB run
  const pbRun = await db.runs.get(pb.runId)
  if (!pbRun) {
    // PB run doesn't exist - return absolute KPS
    return runAbsoluteKPS
  }

  // INVARIANT: PB run always returns 100, by definition
  if (run.id && pb.runId && run.id === pb.runId) {
    return 100
  }

  // Calculate PB absolute KPS using the profile snapshot from when PB was set
  const pbAbsoluteKPS = calculateAbsoluteKPS(pbRun, pb.profileSnapshot)

  if (!isValidKPS(pbAbsoluteKPS)) {
    // Invalid PB KPS - return absolute KPS as fallback
    return runAbsoluteKPS
  }

  // Calculate relative KPS
  const relativeKPS = (runAbsoluteKPS / pbAbsoluteKPS) * 100

  if (isNaN(relativeKPS) || !isFinite(relativeKPS)) {
    return runAbsoluteKPS // Fallback to absolute
  }

  return relativeKPS
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
      profileSnapshot: currentProfile
    })
    return true
  }

  // Get PB run
  const pbRun = await db.runs.get(pb.runId)
  if (!pbRun) {
    // PB run doesn't exist - set new run as PB
    await db.pb.update(pb.id!, {
      runId: newRun.id,
      achievedAt: newRun.date,
      profileSnapshot: currentProfile
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
      profileSnapshot: currentProfile
    })
    return true
  }

  // Check if new run beats PB (strictly better)
  if (newRunAbsoluteKPS > pbAbsoluteKPS) {
    // New PB!
    await db.pb.update(pb.id!, {
      runId: newRun.id,
      achievedAt: newRun.date,
      profileSnapshot: currentProfile
    })
    return true
  }

  return false // Not a new PB
}

/**
 * Seed initial PB from historical fact: September 30th, 2025 run
 *
 * HISTORICAL INITIALIZATION STEP:
 * This function declares the authoritative PB: the run performed on 2025-09-30.
 * This is a data decision, not a heuristic or inference.
 *
 * INVARIANT: Idempotent - if PB already exists, does nothing.
 *
 * @param currentProfile - Current user profile (used as snapshot since historical profile unavailable)
 */
export async function seedInitialPB(currentProfile: UserProfile): Promise<void> {
  // Check if PB already exists - idempotent guard
  const existingPB = await getPB()
  if (existingPB) {
    return
  }

  // Find the run from 2025-09-30
  const targetDate = '2025-09-30'
  const allRuns = await db.runs.toArray()

  // Find all runs on September 30th, 2025
  const sep30Runs = allRuns.filter(run => {
    const runDate = run.date.split('T')[0] // Extract YYYY-MM-DD
    return runDate === targetDate
  })

  // Fail loudly if multiple runs exist on that date
  if (sep30Runs.length > 1) {
    const errorMsg = `MULTIPLE RUNS FOUND ON ${targetDate}. Manual selection required. Found ${sep30Runs.length} runs: ${sep30Runs.map(r => `ID ${r.id}`).join(', ')}`
    throw new Error(errorMsg)
  }

  // Fail loudly if no run found
  if (sep30Runs.length === 0) {
    throw new Error(`NO RUN FOUND ON ${targetDate}. Cannot seed PB.`)
  }

  // Exactly one run found - this is our PB
  const pbRun = sep30Runs[0]

  if (!pbRun.id) {
    throw new Error('PB RUN HAS NO ID. Cannot seed PB.')
  }

  // Create PB record
  await db.pb.add({
    runId: pbRun.id,
    achievedAt: pbRun.date,
    profileSnapshot: currentProfile
  })
}

/**
 * Initialize PB from existing runs if no PB is set
 * This is a one-time migration for existing data
 *
 * @deprecated Use seedInitialPB() instead
 */
export async function initializePBFromExistingRuns(currentProfile: UserProfile): Promise<void> {
  try {
    await seedInitialPB(currentProfile)
    return
  } catch {
    // If seeding fails (no Sep 30 run), fall back to old logic
  }

  const pb = await getPB()
  if (pb) {
    return
  }

  const allRuns = await db.runs.toArray()
  if (allRuns.length === 0) {
    return
  }

  // Find run with highest absolute KPS using current profile
  let bestRun: RunRecord | null = null
  let bestKPS = 0

  for (const run of allRuns) {
    const kps = calculateAbsoluteKPS(run, currentProfile)
    if (isValidKPS(kps) && kps > bestKPS && run.id) {
      bestKPS = kps
      bestRun = run
    }
  }

  if (bestRun && bestRun.id) {
    await db.pb.add({
      runId: bestRun.id,
      achievedAt: bestRun.date,
      profileSnapshot: currentProfile
    })
  }
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
