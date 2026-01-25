import type { ActionType, AutonomyContext } from './types';

export const LEVELS = ['observing', 'advisory', 'limited', 'full'] as const;
export type AutonomyLevel = (typeof LEVELS)[number];

function readEnabled(): boolean {
  return (import.meta.env?.OPSAI_AUTONOMY_ENABLED ?? process.env.OPSAI_AUTONOMY_ENABLED ?? 'false') === 'true';
}

function readLevel(): AutonomyLevel {
  const configured = (import.meta.env?.OPSAI_AUTONOMY_LEVEL ?? process.env.OPSAI_AUTONOMY_LEVEL ?? 'observing') as
    | AutonomyLevel
    | string;
  return LEVELS.includes(configured as AutonomyLevel) ? (configured as AutonomyLevel) : 'observing';
}

export function isAutonomyEnabled(): boolean {
  return readEnabled();
}

export function getAutonomyLevel(): AutonomyLevel {
  return readLevel();
}

export function canTakeAction(context: AutonomyContext, actionType: ActionType): boolean {
  const level = getAutonomyLevel();
  if (!isAutonomyEnabled()) return false;
  if (level === 'observing' || level === 'advisory') return false;

  if (level === 'limited') {
    return actionType === 'trigger_synthetic' || actionType === 'set_risk_flag' || actionType === 'raise_incident';
  }

  if (level === 'full') {
    if (actionType === 'run_playbook' && context.health?.status === 'red') return true;
    return true;
  }

  return false;
}
