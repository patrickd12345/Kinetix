import type { OpsDeployment, OpsIncident, OpsMetrics, OpsPredictions, OpsState } from '../types';

let state: OpsState = {
  health: { status: 'green', summary: 'Initial' },
  metrics: { latencyP99: 300, errorRate: 0.01, requestRate: 150 },
  incidents: [],
  deployments: [],
  predictions: { riskFlags: {} },
};

export function getOpsState(): OpsState {
  return state;
}

export function updateMetrics(metrics: Partial<OpsMetrics>) {
  state = { ...state, metrics: { ...state.metrics, ...metrics } };
}

export function addIncident(incident: OpsIncident) {
  state = { ...state, incidents: [incident, ...state.incidents] };
}

export function addDeployment(deployment: OpsDeployment) {
  state = { ...state, deployments: [deployment, ...state.deployments] };
}

export function setPredictions(predictions: Partial<OpsPredictions>) {
  state = { ...state, predictions: { ...state.predictions, ...predictions } };
}

export function replaceState(next: OpsState) {
  state = next;
}
