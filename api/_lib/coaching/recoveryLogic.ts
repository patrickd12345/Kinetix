/**
 * Recovery-Aware Coaching Logic
 * KX-FEAT-006: Recovery-Aware Coaching Foundation
 */

export enum RecoveryState {
  OPTIMAL = 'optimal',
  MODERATE = 'moderate',
  REDUCED_INTENSITY_RECOMMENDED = 'reduced_intensity_recommended',
}

export interface CoachingDecision {
  recoveryState: RecoveryState;
  guidance: string;
  decisionCode: string;
  visibleReason: string;
}

export interface RecoveryInput {
  sleepScore?: number | null;
  bodyBattery?: number | null;
}

/**
 * Deterministic coaching logic based on recovery metrics.
 *
 * Rules:
 * If sleepScore < 60 OR bodyBattery < 40:
 *   - recoveryState = REDUCED_INTENSITY_RECOMMENDED
 *   - guidance = "Recovery is low today. Prefer easy effort or rest."
 */
export function evaluateRecoveryCoaching(input: RecoveryInput): CoachingDecision {
  const { sleepScore, bodyBattery } = input;

  const lowSleep = sleepScore !== null && sleepScore !== undefined && sleepScore < 60;
  const lowBattery = bodyBattery !== null && bodyBattery !== undefined && bodyBattery < 40;

  if (lowSleep || lowBattery) {
    let reason = '';
    if (lowSleep && lowBattery) {
      reason = 'Both sleep score and body battery are low.';
    } else if (lowSleep) {
      reason = 'Sleep score is below 60.';
    } else {
      reason = 'Body battery is below 40.';
    }

    return {
      recoveryState: RecoveryState.REDUCED_INTENSITY_RECOMMENDED,
      guidance: 'Recovery is low today. Prefer easy effort or rest.',
      decisionCode: 'LOW_RECOVERY_REDUCED_INTENSITY',
      visibleReason: reason,
    };
  }

  return {
    recoveryState: RecoveryState.OPTIMAL,
    guidance: 'Your recovery looks good. Stick to your planned training.',
    decisionCode: 'OPTIMAL_RECOVERY',
    visibleReason: 'Recovery metrics are within optimal range.',
  };
}
