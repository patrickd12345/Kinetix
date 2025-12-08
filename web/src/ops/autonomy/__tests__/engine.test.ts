import { describe, expect, it } from 'vitest';
import { evaluateAutonomousActions } from '../engine';
import type { AutonomyContext } from '../types';

const baseContext: AutonomyContext = {
  health: { status: 'green' },
  metrics: { latencyP99: 200, errorRate: 0.01 },
  incidents: [],
  deployments: [],
  predictions: { riskFlags: {} },
};

describe('autonomy engine', () => {
  it('raises incident and synthetic when health red with latency', () => {
    const actions = evaluateAutonomousActions({
      ...baseContext,
      health: { status: 'red' },
      metrics: { latencyP99: 2000, errorRate: 0.02 },
    });
    const types = actions.map((a) => a.type);
    expect(types).toContain('raise_incident');
    expect(types).toContain('trigger_synthetic');
  });

  it('proposes rollback when errors spike after deploy', () => {
    const actions = evaluateAutonomousActions({
      ...baseContext,
      metrics: { latencyP99: 500, errorRate: 0.2 },
      deployments: [
        {
          id: 'deploy-1',
          version: '1.2.3',
          environment: 'production',
          startedAt: new Date().toISOString(),
          status: 'success',
        },
      ],
    });
    expect(actions.some((a) => a.type === 'run_playbook')).toBe(true);
  });

  it('sets risk flag when predictions warn', () => {
    const actions = evaluateAutonomousActions({
      ...baseContext,
      predictions: { riskFlags: { latency: true } },
    });
    expect(actions.some((a) => a.type === 'set_risk_flag')).toBe(true);
  });
});
