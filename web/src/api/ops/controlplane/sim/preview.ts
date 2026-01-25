import { evaluateAutonomousActions } from '../../../../ops/autonomy/engine';
import type { SimulationScenarioName } from '../../../../ops/sim/types';
import { evaluateScenario } from '../../../../ops/sim/scenarios';
import { getOpsState } from '../../../../ops/api/state';

export function previewSimulation(scenario: SimulationScenarioName) {
  const simulated = evaluateScenario(scenario, getOpsState());
  const actions = evaluateAutonomousActions(simulated);
  return { state: simulated, actions };
}
