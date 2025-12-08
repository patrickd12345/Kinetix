import type { OpsState } from '../types';
import { generateId } from '../utils/id';
import type { SimulationScenario, SimulationScenarioName } from './types';

function baseState(): OpsState {
  return {
    health: { status: 'green', summary: 'All systems nominal' },
    metrics: { latencyP99: 250, errorRate: 0.002, requestRate: 200 },
    incidents: [],
    deployments: [
      {
        id: 'deploy-main',
        version: '2024.01.0',
        environment: 'production',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: 'success',
        source: 'internal',
      },
    ],
    predictions: { riskFlags: {}, narrative: 'Stable' },
  };
}

const scenarios: Record<SimulationScenarioName, SimulationScenario> = {
  healthy: {
    name: 'healthy',
    description: 'Baseline healthy system state',
    apply: (context) => ({ ...baseState(), ...context }),
  },
  null_deployments: {
    name: 'null_deployments',
    description: 'No deployments available',
    apply: (context) => ({ ...baseState(), ...context, deployments: [] }),
  },
  latency_spike: {
    name: 'latency_spike',
    description: 'Simulated latency spike across API tier',
    apply: (context) => ({
      ...baseState(),
      ...context,
      health: { status: 'red', summary: 'Latency spike detected' },
      metrics: { ...baseState().metrics, latencyP99: 3200, errorRate: 0.01 },
    }),
  },
  error_spike: {
    name: 'error_spike',
    description: 'High error rate after deployment',
    apply: (context) => ({
      ...baseState(),
      ...context,
          metrics: { ...baseState().metrics, errorRate: 0.12 },
      incidents: [
        {
          id: generateId(),
          title: 'Error spike detected',
          source: 'simulation',
          severity: 'high',
          createdAt: new Date().toISOString(),
          status: 'open',
        },
      ],
    }),
  },
  db_down: {
    name: 'db_down',
    description: 'Database unavailable leading to major outage',
    apply: (context) => ({
      ...baseState(),
      ...context,
      health: { status: 'red', summary: 'Database unreachable' },
      metrics: { latencyP99: 5000, errorRate: 0.65, requestRate: 10 },
      incidents: [
        {
          id: generateId(),
          title: 'Database outage',
          source: 'simulation',
          severity: 'critical',
          createdAt: new Date().toISOString(),
          status: 'open',
        },
      ],
      predictions: { riskFlags: { db_down: true }, narrative: 'Immediate remediation required' },
    }),
  },
  worker_overload: {
    name: 'worker_overload',
    description: 'Background jobs piling up',
    apply: (context) => ({
      ...baseState(),
      ...context,
      metrics: { latencyP99: 1800, errorRate: 0.08, requestRate: 50 },
      predictions: { riskFlags: { worker_overload: true }, narrative: 'Workers overloaded' },
    }),
  },
  sentry_issue_storm: {
    name: 'sentry_issue_storm',
    description: 'Wave of Sentry issues to validate integrations',
    apply: (context) => ({
      ...baseState(),
      ...context,
      incidents: new Array(5).fill(null).map((_, idx) => ({
        id: generateId(),
        title: `Synthetic Sentry issue #${idx + 1}`,
        source: 'sentry',
        severity: idx % 2 === 0 ? 'medium' : 'high',
        createdAt: new Date().toISOString(),
        status: 'open',
      })),
      metrics: { ...baseState().metrics, errorRate: 0.2, latencyP99: 900 },
      predictions: { riskFlags: { sentry_noise: true }, narrative: 'External errors rising' },
    }),
  },
};

export function listScenarios(): SimulationScenario[] {
  return Object.values(scenarios);
}

export function evaluateScenario(name: SimulationScenarioName, base: OpsState = baseState()): OpsState {
  const scenario = scenarios[name];
  if (!scenario) {
    return base;
  }
  return scenario.apply(base);
}

export function runScenario(name: SimulationScenarioName): OpsState {
  return evaluateScenario(name, baseState());
}
