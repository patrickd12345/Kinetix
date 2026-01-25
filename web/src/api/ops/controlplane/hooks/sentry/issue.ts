import { addIncident, getOpsState } from '../../../../../ops/api/state';
import { evaluateAutonomousActions, runAutonomousActions } from '../../../../../ops/autonomy/engine';
import { isAutonomyEnabled } from '../../../../../ops/autonomy/policy';
import type { AutonomousAction } from '../../../../../ops/autonomy/types';
import { parseIssueWebhook } from '../../../../../ops/sentry/client';
import { sentryIssueToIncident } from '../../../../../ops/sentry/mappers';

export async function handleSentryIssue(body: any): Promise<{ incident: any; actions?: AutonomousAction[] }> {
  const issue = parseIssueWebhook(body);
  const incident = sentryIssueToIncident(issue);
  addIncident(incident);
  let actions: AutonomousAction[] | undefined;
  if (isAutonomyEnabled()) {
    actions = await runAutonomousActions(getOpsState());
  } else {
    actions = evaluateAutonomousActions(getOpsState());
  }
  return { incident, actions };
}
