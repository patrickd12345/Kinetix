import { replaceState } from '../../../../ops/api/state';
import { runAutonomousActions } from '../../../../ops/autonomy/engine';
import { isAutonomyEnabled } from '../../../../ops/autonomy/policy';
import type { AutonomousAction } from '../../../../ops/autonomy/types';
import type { SimulationScenarioName } from '../../../../ops/sim/types';
import { executeSimulation } from '../../../../ops/sim/engine';

export async function runSimulation(body: { scenario: SimulationScenarioName }): Promise<{ state: any; actions?: AutonomousAction[] }> {
  const simulatedState = executeSimulation(body.scenario);
  replaceState(simulatedState);
  const actions = isAutonomyEnabled() ? await runAutonomousActions(simulatedState) : [];
  return { state: simulatedState, actions };
}
