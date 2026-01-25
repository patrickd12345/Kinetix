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
 * Calculate NPI using Riegel formula with age and weight normalization
 * Allows comparison across distances, ages, and weight variations
 * 
 * @param runData - The run data (distance and time)
 * @param userProfile - User profile with age and weight for normalization
 * @param referenceDistanceKm - Standard reference distance (default: 10K)
 * @returns Normalized Performance Index
 */
export function calculateNPI(
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
  
  // Convert to NPI (inverted pace, scaled for readability)
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

/**
 * Calculate NPI from race data
 */
export function calculateNPIFromRace(
  distance: number,
  timeSeconds: number,
  userProfile: UserProfile,
  unit: 'metric' | 'imperial' = 'metric'
): number {
  return calculateNPI({ distanceKm: distance, timeSeconds, unit }, userProfile);
}

/**
 * Compare two runs using NPI (accounts for distance, age, weight differences)
 */
export function compareRuns(
  run1: RunData & { userProfile: UserProfile },
  run2: RunData & { userProfile: UserProfile }
): { npi1: number; npi2: number; difference: number; percentageDiff: number } {
  const npi1 = calculateNPI(run1, run1.userProfile);
  const npi2 = calculateNPI(run2, run2.userProfile);
  const difference = npi2 - npi1;
  const percentageDiff = (difference / npi1) * 100;
  
  return { npi1, npi2, difference, percentageDiff };
}
