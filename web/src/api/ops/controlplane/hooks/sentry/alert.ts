import { addIncident, getOpsState, setPredictions } from '../../../../../ops/api/state';
import { evaluateAutonomousActions, runAutonomousActions } from '../../../../../ops/autonomy/engine';
import { isAutonomyEnabled } from '../../../../../ops/autonomy/policy';
import type { AutonomousAction } from '../../../../../ops/autonomy/types';
import { parseAlertWebhook } from '../../../../../ops/sentry/client';
import { sentryAlertToIncidentOrPlaybookTrigger } from '../../../../../ops/sentry/mappers';

export async function handleSentryAlert(body: any): Promise<{ incident?: any; playbookTrigger?: any; actions?: AutonomousAction[] }> {
  const alert = parseAlertWebhook(body);
  const mapped = sentryAlertToIncidentOrPlaybookTrigger(alert);
  if (mapped.incident) {
    addIncident(mapped.incident);
  }
  if (mapped.playbookTrigger) {
    setPredictions({ riskFlags: { [mapped.playbookTrigger.playbook]: true } });
  }
  const context = getOpsState();
  const actions = isAutonomyEnabled()
    ? await runAutonomousActions(context)
    : evaluateAutonomousActions(context);
  return { ...mapped, actions };
}
