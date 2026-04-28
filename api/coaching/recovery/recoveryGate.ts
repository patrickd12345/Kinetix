import { mapGarminTelemetry, type GarminHealthSnapshot } from '../../integrations/garmin/adapter.js';

export interface RecoveryDecision {
  intensity: 'normal' | 'reduced' | 'rest';
  reason: string;
}

/**
 * Implements the deterministic Recovery Gate for Kinetix AI Coaching.
 * Recommends reduced intensity or complete rest if critical recovery metrics fall below thresholds.
 */
export function evaluateRecoveryGate(snapshot: GarminHealthSnapshot): RecoveryDecision {
  const telemetry = mapGarminTelemetry(snapshot);

  if ((telemetry.sleepScore !== null && telemetry.sleepScore < 60) ||
      (telemetry.bodyBattery !== null && telemetry.bodyBattery < 40)) {
    return {
      intensity: 'reduced',
      reason: 'Critical recovery metrics are low (Sleep < 60 or Body Battery < 40). Adjusting Target KPS to Easy.',
    };
  }

  if (telemetry.sleepScore !== null && telemetry.sleepScore < 40) {
     return {
        intensity: 'rest',
        reason: 'Severe sleep deprivation detected. Complete rest is highly recommended.',
     }
  }

  return {
    intensity: 'normal',
    reason: 'Recovery metrics are nominal. Maintain Target KPS.',
  };
}
