import { evaluateAutonomousActions } from '../../../ops/autonomy/engine';
import { getAutonomyLevel, isAutonomyEnabled } from '../../../ops/autonomy/policy';
import type { AutonomousAction, AutonomyContext } from '../../../ops/autonomy/types';

let lastActions: AutonomousAction[] = [];

export function autonomyStatus(context?: AutonomyContext) {
  if (context) {
    lastActions = evaluateAutonomousActions(context);
  }
  return {
    enabled: isAutonomyEnabled(),
    level: getAutonomyLevel(),
    lastActions,
  };
}
