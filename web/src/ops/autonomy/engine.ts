import type { OpsDeployment, OpsMetrics, OpsPredictions } from '../types';
import { generateId } from '../utils/id';
import { canTakeAction, getAutonomyLevel, isAutonomyEnabled } from './policy';
import {
  executeRaiseIncident,
  executeRestartComponent,
  executeRunPlaybook,
  executeSetRiskFlag,
  executeTriggerSyntheticCheck,
} from './actions';
import type { ActionType, AutonomousAction, AutonomyContext, OpsComponent } from './types';

function createPendingAction(type: ActionType, reason: string, target?: OpsComponent | string): AutonomousAction {
  return {
    id: generateId(),
    type,
    target,
    reason,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
}

function healthIsRed(health: { status?: string }): boolean {
  return (health?.status ?? '').toLowerCase() === 'red';
}

function latencySevere(metrics: OpsMetrics): boolean {
  return Boolean(metrics.latencyP99 && metrics.latencyP99 > 1500);
}

function errorSpike(metrics: OpsMetrics): boolean {
  return Boolean(metrics.errorRate && metrics.errorRate > 0.05);
}

function deployRecent(deployments: OpsDeployment[]): OpsDeployment | undefined {
  return deployments
    .slice()
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .find((d) => d.status === 'in_progress' || d.status === 'success');
}

function predictedDegradation(predictions: OpsPredictions): boolean {
  return Object.values(predictions.riskFlags).some(Boolean);
}

export function evaluateAutonomousActions(context: AutonomyContext): AutonomousAction[] {
  const actions: AutonomousAction[] = [];
  const health = context.health ?? {};
  const metrics: OpsMetrics = context.metrics ?? {};
  const deployments: OpsDeployment[] = context.deployments ?? [];
  const predictions: OpsPredictions = context.predictions ?? { riskFlags: {} };

  if (healthIsRed(health) && latencySevere(metrics)) {
    actions.push(createPendingAction('raise_incident', 'Health red with severe latency'));
    actions.push(createPendingAction('trigger_synthetic', 'Validate outage via synthetic checks'));
  }

  const recentDeploy = deployRecent(deployments);
  if (recentDeploy && errorSpike(metrics) && recentDeploy.status !== 'failed') {
    actions.push(createPendingAction('run_playbook', `Rollback ${recentDeploy.version}`));
  }

  if (predictedDegradation(predictions)) {
    actions.push(createPendingAction('set_risk_flag', 'L7 predicts degradation', 'predicted_degradation'));
    actions.push(createPendingAction('trigger_synthetic', 'Pre-emptive synthetic check'));
  }

  return actions;
}

export async function runAutonomousActions(context: AutonomyContext): Promise<AutonomousAction[]> {
  const evaluated = evaluateAutonomousActions(context);
  if (!isAutonomyEnabled()) {
    return evaluated.map((action) => ({ ...action, status: 'skipped' }));
  }

  const level = getAutonomyLevel();
  const executed: AutonomousAction[] = [];

  for (const action of evaluated) {
    if (!canTakeAction(context, action.type)) {
      executed.push({ ...action, status: level === 'observing' ? 'skipped' : 'pending' });
      continue;
    }

    switch (action.type) {
      case 'restart_component':
        executed.push(executeRestartComponent((action.target ?? 'api') as OpsComponent, action.reason));
        break;
      case 'trigger_synthetic':
        executed.push(executeTriggerSyntheticCheck(action.reason));
        break;
      case 'run_playbook':
        executed.push(executeRunPlaybook(String(action.target ?? 'rollback'), action.reason));
        break;
      case 'raise_incident':
        executed.push(executeRaiseIncident(action.reason));
        break;
      case 'set_risk_flag':
        executed.push(executeSetRiskFlag(String(action.target ?? 'general'), action.metadata?.value ?? true, action.reason));
        break;
      default:
        executed.push({ ...action, status: 'skipped' });
    }
  }

  return executed;
}
