import type { OpsState } from '../types';
import type { SimulationScenarioName } from './types';
import { evaluateScenario, listScenarios, runScenario } from './scenarios';

export function simulateState(name: SimulationScenarioName, baseState: OpsState): OpsState {
  return evaluateScenario(name, baseState);
}

export function availableSimulations() {
  return listScenarios();
}

export function executeSimulation(name: SimulationScenarioName): OpsState {
  return runScenario(name);
}
