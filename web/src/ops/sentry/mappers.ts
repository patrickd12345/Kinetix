import type { OpsDeployment, OpsIncident } from '../types';
import type { SentryAlert, SentryDeploy, SentryIssue } from './types';

export function sentryIssueToIncident(issue: SentryIssue): OpsIncident {
  const severityMap: Record<string, OpsIncident['severity']> = {
    fatal: 'critical',
    error: 'high',
    warning: 'medium',
    info: 'low',
  };

  return {
    id: issue.id,
    title: issue.title,
    source: 'sentry',
    severity: severityMap[issue.level ?? 'error'] ?? 'medium',
    createdAt: issue.timestamp,
    status: 'open',
    metadata: {
      culprit: issue.culprit,
      project: issue.project,
      webUrl: issue.webUrl,
    },
  };
}

export function sentryDeployToDeployment(deploy: SentryDeploy): OpsDeployment {
  return {
    id: `${deploy.release}-${deploy.environment}`,
    version: deploy.version ?? deploy.release,
    environment: deploy.environment,
    startedAt: deploy.dateStarted ?? new Date().toISOString(),
    completedAt: deploy.dateFinished,
    status: deploy.dateFinished ? 'success' : 'in_progress',
    source: 'sentry',
  };
}

export function sentryAlertToIncidentOrPlaybookTrigger(alert: SentryAlert): {
  incident?: OpsIncident;
  playbookTrigger?: { playbook: string; reason: string };
} {
  const incident: OpsIncident = {
    id: alert.id,
    title: alert.title,
    source: 'sentry',
    severity: alert.status === 'firing' ? 'high' : 'low',
    createdAt: alert.timestamp,
    status: alert.status === 'resolved' ? 'resolved' : 'open',
    metadata: {
      environment: alert.environment,
      metric: alert.metric,
      threshold: alert.threshold,
    },
  };

  const playbookTrigger = alert.metric
    ? {
        playbook: `stabilize-${alert.metric}`,
        reason: `Sentry alert for ${alert.metric}`,
      }
    : undefined;

  return { incident, playbookTrigger };
}
