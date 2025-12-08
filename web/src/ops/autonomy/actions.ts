import type { OpsIncident } from '../types';
import { generateId } from '../utils/id';
import type { AutonomousAction, OpsComponent } from './types';

function logAction(message: string, payload?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.info(`[autonomy] ${message}`, payload ?? '');
}

export function executeRestartComponent(component: OpsComponent, reason: string): AutonomousAction {
  const action: AutonomousAction = {
    id: generateId(),
    type: 'restart_component',
    target: component,
    reason,
    createdAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    status: 'executed',
  };
  logAction(`restart requested for ${component}`, { reason });
  return action;
}

export function executeTriggerSyntheticCheck(reason: string): AutonomousAction {
  const action: AutonomousAction = {
    id: generateId(),
    type: 'trigger_synthetic',
    reason,
    createdAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    status: 'executed',
  };
  logAction('synthetic check triggered', { reason });
  return action;
}

export function executeRunPlaybook(playbookId: string, reason: string): AutonomousAction {
  const action: AutonomousAction = {
    id: generateId(),
    type: 'run_playbook',
    target: playbookId,
    reason,
    createdAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    status: 'executed',
  };
  logAction(`playbook ${playbookId} executed`, { reason });
  return action;
}

export function executeRaiseIncident(reason: string, details?: Partial<OpsIncident>): AutonomousAction {
  const incident: OpsIncident = {
    id: details?.id ?? generateId(),
    title: details?.title ?? reason,
    severity: details?.severity ?? 'high',
    createdAt: details?.createdAt ?? new Date().toISOString(),
    status: details?.status ?? 'open',
    source: 'internal',
    metadata: details?.metadata,
  };
  logAction('incident raised', { incident });
  return {
    id: generateId(),
    type: 'raise_incident',
    reason,
    createdAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    status: 'executed',
    metadata: { incident },
  };
}

export function executeSetRiskFlag(flag: string, value: unknown, reason: string): AutonomousAction {
  const action: AutonomousAction = {
    id: generateId(),
    type: 'set_risk_flag',
    target: flag,
    reason,
    createdAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    status: 'executed',
    metadata: { value },
  };
  logAction(`risk flag updated: ${flag}`, { value, reason });
  return action;
}
