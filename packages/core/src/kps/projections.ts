import { calculateKPS, UserProfile, RunData } from './calculator';

export interface ProjectionResult {
  timeToBeat: string | null;
  progress: number;
  distanceRemaining: number;
  timeRemaining: number;
}

/**
 * Calculate time-to-beat projection based on current run data and target KPS
 */
export function calculateTimeToBeat(
  currentDistanceKm: number,
  currentTimeSeconds: number,
  currentPaceSecondsPerKm: number,
  targetKPS: number,
  userProfile: UserProfile
): ProjectionResult {
  if (currentDistanceKm < 0.05) {
    // During initial calibration (first 50m), no projection
    return {
      timeToBeat: null,
      progress: 0,
      distanceRemaining: 0,
      timeRemaining: 0
    };
  }

  // Calculate current KPS
  const currentRunData: RunData = {
    distanceKm: currentDistanceKm,
    timeSeconds: currentTimeSeconds,
    unit: 'metric'
  };
  const currentKPS = calculateKPS(currentRunData, userProfile);

  // Check if target already reached
  if (currentKPS >= targetKPS) {
    return {
      timeToBeat: 'TARGET REACHED!',
      progress: 1.0,
      distanceRemaining: 0,
      timeRemaining: 0
    };
  }

  // Projection logic: calculate distance needed to reach target KPS
  const roundingThreshold = targetKPS - 0.5;
  const term = 10 * ((roundingThreshold * (currentTimeSeconds / 60) / (currentDistanceKm)) / 500 - 1);

  if (term < 5) {
    const distNeeded = Math.exp(term) - 0.1;
    const distRemaining = distNeeded - currentDistanceKm;

    if (distRemaining > 0) {
      const timeSecs = distRemaining * currentPaceSecondsPerKm;
      const m = Math.floor(timeSecs / 60);
      const s = Math.floor(timeSecs % 60);

      const paceMin = Math.floor(currentPaceSecondsPerKm / 60);
      const paceSec = Math.floor(currentPaceSecondsPerKm % 60);

      const totalExpectedTime = currentTimeSeconds + timeSecs;
      const progress = totalExpectedTime > 0 ? currentTimeSeconds / totalExpectedTime : 0;

      return {
        timeToBeat: `${m}:${s.toString().padStart(2, '0')} @ AVG ${paceMin}:${paceSec.toString().padStart(2, '0')}`,
        progress: Math.min(Math.max(progress, 0), 1),
        distanceRemaining: distRemaining,
        timeRemaining: timeSecs
      };
    } else {
      return {
        timeToBeat: 'TARGET REACHED!',
        progress: 1.0,
        distanceRemaining: 0,
        timeRemaining: 0
      };
    }
  } else {
    return {
      timeToBeat: 'INCREASE PACE',
      progress: 0.02,
      distanceRemaining: Infinity,
      timeRemaining: Infinity
    };
  }
}
