import { describe, it, expect } from 'vitest';
import { evaluateRecoveryCoaching, RecoveryState } from './recoveryLogic';

describe('evaluateRecoveryCoaching', () => {
  it('returns optimal state when metrics are good', () => {
    const input = { sleepScore: 80, bodyBattery: 70 };
    const result = evaluateRecoveryCoaching(input);
    expect(result.recoveryState).toBe(RecoveryState.OPTIMAL);
    expect(result.decisionCode).toBe('OPTIMAL_RECOVERY');
  });

  it('recommends reduced intensity when sleep score is low', () => {
    const input = { sleepScore: 50, bodyBattery: 70 };
    const result = evaluateRecoveryCoaching(input);
    expect(result.recoveryState).toBe(RecoveryState.REDUCED_INTENSITY_RECOMMENDED);
    expect(result.decisionCode).toBe('LOW_RECOVERY_REDUCED_INTENSITY');
    expect(result.visibleReason).toContain('Sleep score is below 60');
  });

  it('recommends reduced intensity when body battery is low', () => {
    const input = { sleepScore: 80, bodyBattery: 30 };
    const result = evaluateRecoveryCoaching(input);
    expect(result.recoveryState).toBe(RecoveryState.REDUCED_INTENSITY_RECOMMENDED);
    expect(result.decisionCode).toBe('LOW_RECOVERY_REDUCED_INTENSITY');
    expect(result.visibleReason).toContain('Body battery is below 40');
  });

  it('handles null/undefined values by defaulting to optimal if not present', () => {
    const result = evaluateRecoveryCoaching({});
    expect(result.recoveryState).toBe(RecoveryState.OPTIMAL);
  });
});
