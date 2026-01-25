import { describe, expect, it } from 'vitest';
import { evaluateScenario, listScenarios } from '../scenarios';
import { runScenario } from '../scenarios';

describe('simulation engine', () => {
  it('lists scenarios', () => {
    const scenarios = listScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
  });

  it('null_deployments removes deployments', () => {
    const result = evaluateScenario('null_deployments', {
      health: { status: 'green' },
      metrics: {},
      incidents: [],
      deployments: [{ id: '1', version: '1', environment: 'prod', startedAt: new Date().toISOString(), status: 'success' }],
      predictions: { riskFlags: {} },
    });
    expect(result.deployments.length).toBe(0);
  });

  it('latency_spike inflates latency', () => {
    const result = runScenario('latency_spike');
    expect(result.metrics.latencyP99).toBeGreaterThan(1000);
    expect(result.health.status).toBe('red');
  });
});
