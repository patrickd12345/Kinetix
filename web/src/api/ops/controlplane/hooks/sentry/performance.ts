import { getOpsState, updateMetrics } from '../../../../../ops/api/state';
import { evaluateAutonomousActions, runAutonomousActions } from '../../../../../ops/autonomy/engine';
import { isAutonomyEnabled } from '../../../../../ops/autonomy/policy';
import type { AutonomousAction } from '../../../../../ops/autonomy/types';
import { parsePerformanceWebhook } from '../../../../../ops/sentry/client';

export async function handleSentryPerformance(body: any): Promise<{ performance: any; actions?: AutonomousAction[] }> {
  const perf = parsePerformanceWebhook(body);
  updateMetrics({ latencyP99: perf.duration, notes: perf.transaction });
  const context = getOpsState();
  const actions = isAutonomyEnabled()
    ? await runAutonomousActions(context)
    : evaluateAutonomousActions(context);
  return { performance: perf, actions };
}
