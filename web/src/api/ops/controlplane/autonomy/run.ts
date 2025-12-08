import { runAutonomousActions } from '../../../ops/autonomy/engine';
import type { AutonomyContext } from '../../../ops/autonomy/types';

export async function autonomyRun(context: AutonomyContext) {
  const actions = await runAutonomousActions(context);
  return actions;
}
