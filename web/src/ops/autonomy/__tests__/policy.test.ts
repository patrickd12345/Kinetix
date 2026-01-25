import { describe, expect, it, beforeEach } from 'vitest';
import { canTakeAction, getAutonomyLevel, isAutonomyEnabled } from '../policy';
import type { AutonomyContext } from '../types';

const baseContext: AutonomyContext = {
  health: { status: 'green' },
  metrics: {},
  incidents: [],
  deployments: [],
  predictions: { riskFlags: {} },
};

describe('autonomy policy', () => {
  beforeEach(() => {
    process.env.OPSAI_AUTONOMY_ENABLED = 'false';
    process.env.OPSAI_AUTONOMY_LEVEL = 'observing';
  });

  it('disables actions when autonomy disabled', () => {
    process.env.OPSAI_AUTONOMY_ENABLED = 'false';
    expect(isAutonomyEnabled()).toBe(false);
    expect(canTakeAction(baseContext, 'trigger_synthetic')).toBe(false);
  });

  it('observing mode blocks execution', () => {
    process.env.OPSAI_AUTONOMY_ENABLED = 'true';
    process.env.OPSAI_AUTONOMY_LEVEL = 'observing';
    expect(getAutonomyLevel()).toBe('observing');
    expect(canTakeAction(baseContext, 'restart_component')).toBe(false);
  });

  it('limited mode allows synthetic and risk flags only', () => {
    process.env.OPSAI_AUTONOMY_ENABLED = 'true';
    process.env.OPSAI_AUTONOMY_LEVEL = 'limited';
    expect(canTakeAction(baseContext, 'trigger_synthetic')).toBe(true);
    expect(canTakeAction(baseContext, 'restart_component')).toBe(false);
  });
});
