import { addDeployment, getOpsState } from '../../../../../ops/api/state';
import { evaluateAutonomousActions, runAutonomousActions } from '../../../../../ops/autonomy/engine';
import { isAutonomyEnabled } from '../../../../../ops/autonomy/policy';
import type { AutonomousAction } from '../../../../../ops/autonomy/types';
import { parseDeployWebhook } from '../../../../../ops/sentry/client';
import { sentryDeployToDeployment } from '../../../../../ops/sentry/mappers';

export async function handleSentryDeploy(body: any): Promise<{ deployment: any; actions?: AutonomousAction[] }> {
  const deploy = parseDeployWebhook(body);
  const deployment = sentryDeployToDeployment(deploy);
  addDeployment(deployment);
  const context = getOpsState();
  const actions = isAutonomyEnabled()
    ? await runAutonomousActions(context)
    : evaluateAutonomousActions(context);
  return { deployment, actions };
}
