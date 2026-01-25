/**
 * Detect cardiac drift - when heart rate increases while pace stays constant
 * This indicates fatigue and suggests a recovery pace
 */
export interface CardiacDriftResult {
  isDrifting: boolean;
  recommendedPaceSecondsPerKm: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Detect cardiac drift based on heart rate and pace data
 * @param currentHR Current heart rate (BPM)
 * @param averageHR Average heart rate over the run (BPM)
 * @param currentPace Current pace (seconds per km)
 * @param averagePace Average pace (seconds per km)
 * @param durationSeconds Duration of run in seconds
 */
export function detectCardiacDrift(
  currentHR: number,
  averageHR: number,
  currentPace: number,
  averagePace: number,
  durationSeconds: number
): CardiacDriftResult {
  // Only check after 5 minutes of running
  if (durationSeconds < 300) {
    return {
      isDrifting: false,
      recommendedPaceSecondsPerKm: currentPace,
      severity: 'low'
    };
  }

  // Calculate pace difference (should be close to 0 if pace is steady)
  const paceDiff = Math.abs(currentPace - averagePace);
  const paceIsSteady = paceDiff < 5; // Within 5 seconds per km

  // Calculate HR increase
  const hrIncrease = currentHR - averageHR;
  const hrIncreasePercent = (hrIncrease / averageHR) * 100;

  // Cardiac drift detected if:
  // 1. Pace is relatively steady (within 5s/km)
  // 2. HR has increased by more than 5% from average
  // 3. Current HR is above 170 BPM (high intensity zone)
  const isDrifting = paceIsSteady && hrIncreasePercent > 5 && currentHR > 170;

  let severity: 'low' | 'medium' | 'high' = 'low';
  let recommendedPace = currentPace;

  if (isDrifting) {
    if (hrIncreasePercent > 15 || currentHR > 185) {
      severity = 'high';
      recommendedPace = currentPace + 45; // Slow down significantly
    } else if (hrIncreasePercent > 10 || currentHR > 180) {
      severity = 'medium';
      recommendedPace = currentPace + 30; // Moderate slowdown
    } else {
      severity = 'low';
      recommendedPace = currentPace + 15; // Slight slowdown
    }
  }

  return {
    isDrifting,
    recommendedPaceSecondsPerKm: recommendedPace,
    severity
  };
}
