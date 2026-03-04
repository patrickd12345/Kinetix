// Riegel formula: T₂ = T₁ × (D₂/D₁)^1.06
// Normalizes performance across distances

export interface UserProfile {
  age: number;
  weightKg: number;
}

export interface RunData {
  distanceKm: number;
  timeSeconds: number;
  unit?: 'metric' | 'imperial';
}

/**
 * Calculate KPS (Kinetix Performance Score) using Riegel formula with age and weight normalization.
 *
 * INVARIANT (NON-NEGOTIABLE): KPS is ALWAYS age-weight graded. Every caller MUST pass a UserProfile
 * with age and weight. There are no exceptions. Stored/cached KPS values must not be used for
 * display or comparison without recalculation using the appropriate profile for that run's date.
 *
 * @param runData - The run data (distance and time)
 * @param userProfile - User profile with age and weight for normalization (REQUIRED)
 * @param referenceDistanceKm - Standard reference distance (default: 10K)
 * @returns Kinetix Performance Score
 */
export function calculateKPS(
  runData: RunData,
  userProfile: UserProfile,
  referenceDistanceKm: number = 10.0
): number {
  const distanceKm = runData.unit === 'imperial'
    ? runData.distanceKm * 1.60934
    : runData.distanceKm;

  // Riegel formula: normalize to reference distance
  // T_reference = T_actual × (D_reference / D_actual)^1.06
  const riegelExponent = 1.06;
  const normalizedTime = runData.timeSeconds * Math.pow(referenceDistanceKm / distanceKm, riegelExponent);

  // Age adjustment (performance typically declines ~0.5-1% per year after peak)
  const ageAdjustment = calculateAgeAdjustment(userProfile.age);

  // Weight adjustment (lighter runners typically faster, but varies by individual)
  const weightAdjustment = calculateWeightAdjustment(userProfile.weightKg);

  // Calculate normalized pace at reference distance
  const normalizedPaceSecondsPerKm = normalizedTime / referenceDistanceKm;

  // Apply age and weight adjustments
  const adjustedPace = normalizedPaceSecondsPerKm * ageAdjustment * weightAdjustment;

  // Convert to KPS (inverted pace, scaled for readability)
  const speedKmH = (1000 / adjustedPace) * 3.6;
  return speedKmH * 10.0; // Scale factor for readability
}

/**
 * Calculate age adjustment factor for performance normalization
 * Peak performance typically around age 25-30
 * After 30, performance declines ~0.5-1% per year
 */
function calculateAgeAdjustment(age: number): number {
  const peakAge = 27.5;
  if (age <= peakAge) return 1.0;
  const yearsPastPeak = age - peakAge;
  const declineRate = 0.007; // 0.7% per year
  return 1.0 + (yearsPastPeak * declineRate);
}

/**
 * Calculate weight adjustment factor for performance normalization
 * Reference weight: 70kg (typical runner)
 * Lighter runners tend to be faster, but relationship is complex
 * Simplified model: ~0.3-0.5% per kg difference
 */
function calculateWeightAdjustment(weightKg: number): number {
  const referenceWeight = 70.0;
  const weightDiff = weightKg - referenceWeight;
  const adjustmentRate = 0.004; // 0.4% per kg
  return 1.0 - (weightDiff * adjustmentRate);
}

const RiegelExponent = 1.06;
const ReferenceDistanceKm = 10.0;

/**
 * Given a target KPS and distance, return the time (seconds) needed to achieve that KPS.
 * Inverse of calculateKPS: useful for "beat PB by X%" run suggestions.
 */
export function timeToAchieveKPS(
  targetKPS: number,
  distanceKm: number,
  userProfile: UserProfile,
  referenceDistanceKm: number = ReferenceDistanceKm
): number {
  if (targetKPS <= 0 || distanceKm <= 0) return 0;
  const ageAdj = calculateAgeAdjustment(userProfile.age);
  const weightAdj = calculateWeightAdjustment(userProfile.weightKg);
  const adjustedPace = 36000 / targetKPS;
  const normalizedPaceSecondsPerKm = adjustedPace / (ageAdj * weightAdj);
  const normalizedTime = normalizedPaceSecondsPerKm * referenceDistanceKm;
  const timeSeconds = normalizedTime / Math.pow(referenceDistanceKm / distanceKm, RiegelExponent);
  return Math.round(timeSeconds);
}

/**
 * Given a target KPS and duration (seconds), return the distance (km) needed to achieve that KPS.
 * Useful for "beat PB" suggestions with a round time (e.g. 15 min).
 */
export function distanceToAchieveKPS(
  targetKPS: number,
  timeSeconds: number,
  userProfile: UserProfile,
  referenceDistanceKm: number = ReferenceDistanceKm
): number {
  if (targetKPS <= 0 || timeSeconds <= 0) return 0;
  const ageAdj = calculateAgeAdjustment(userProfile.age);
  const weightAdj = calculateWeightAdjustment(userProfile.weightKg);
  const adjustedPace = 36000 / targetKPS;
  const normalizedPaceSecondsPerKm = adjustedPace / (ageAdj * weightAdj);
  const normalizedTime = normalizedPaceSecondsPerKm * referenceDistanceKm;
  const distanceKm = referenceDistanceKm / Math.pow(normalizedTime / timeSeconds, 1 / RiegelExponent);
  return Math.round(distanceKm * 1000) / 1000;
}

/**
 * Calculate KPS from race data
 */
export function calculateKPSFromRace(
  distance: number,
  timeSeconds: number,
  userProfile: UserProfile,
  unit: 'metric' | 'imperial' = 'metric'
): number {
  return calculateKPS({ distanceKm: distance, timeSeconds, unit }, userProfile);
}

/**
 * Compare two runs using KPS (accounts for distance, age, weight differences)
 */
export function compareRuns(
  run1: RunData & { userProfile: UserProfile },
  run2: RunData & { userProfile: UserProfile }
): { kps1: number; kps2: number; difference: number; percentageDiff: number } {
  const kps1 = calculateKPS(run1, run1.userProfile);
  const kps2 = calculateKPS(run2, run2.userProfile);
  const difference = kps2 - kps1;
  const percentageDiff = (difference / kps1) * 100;

  return { kps1, kps2, difference, percentageDiff };
}

/**
 * Calculate relative KPS normalized to a baseline run
 * The baseline run will always have KPS = 100
 * All other runs are scaled proportionally
 *
 * @param runData - The run data to calculate KPS for
 * @param runUserProfile - User profile at time of this run
 * @param baselineRunData - The baseline/PB run data
 * @param baselineUserProfile - User profile at time of baseline run
 * @returns Relative KPS (baseline = 100)
 */
export function calculateRelativeKPS(
  runData: RunData,
  runUserProfile: UserProfile,
  baselineRunData: RunData,
  baselineUserProfile: UserProfile
): number {
  // Calculate absolute KPS for both runs
  const runKPS = calculateKPS(runData, runUserProfile);
  const baselineKPS = calculateKPS(baselineRunData, baselineUserProfile);

  // Scale so baseline = 100
  if (baselineKPS === 0) return 0;
  return (runKPS / baselineKPS) * 100;
}
