import type {
  SentryAlert,
  SentryDeploy,
  SentryEvent,
  SentryIssue,
  SentryPerformanceEvent,
} from './types';
import { generateId } from '../utils/id';

function ensureTimestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

export function parseIssueWebhook(body: any): SentryIssue {
  return {
    id: String(body.id ?? body.event?.issue ?? body.issue?.id ?? generateId()),
    title: body.title ?? body.message ?? 'Unknown issue',
    culprit: body.culprit ?? body.issue?.culprit,
    project: body.project ?? body.issue?.project,
    level: body.level ?? body.issue?.level ?? 'error',
    webUrl: body.web_url ?? body.webUrl,
    timestamp: ensureTimestamp(body.timestamp ?? body.received),
  };
}

export function parsePerformanceWebhook(body: any): SentryPerformanceEvent {
  return {
    id: String(body.event_id ?? body.id ?? generateId()),
    transaction: body.transaction ?? body.context?.transaction ?? 'unknown',
    op: body.op ?? body.context?.op ?? 'http.server',
    duration: Number(body.duration ?? body.metrics?.duration ?? 0),
    timestamp: ensureTimestamp(body.timestamp),
  };
}

export function parseDeployWebhook(body: any): SentryDeploy {
  return {
    environment: body.environment ?? 'production',
    release: body.release ?? body.version ?? 'unknown',
    version: body.version ?? body.release,
    dateStarted: body.dateStarted ?? body.date_started ?? ensureTimestamp(body.started),
    dateFinished: body.dateFinished ?? body.date_finished ?? ensureTimestamp(body.finished),
  };
}

export function parseAlertWebhook(body: any): SentryAlert {
  return {
    id: String(body.id ?? generateId()),
    title: body.title ?? body.alert_rule_name ?? 'Sentry alert',
    status: (body.status ?? body.event?.status ?? 'firing') as SentryAlert['status'],
    environment: body.environment ?? body.event?.environment ?? 'production',
    metric: body.metric ?? body.event?.metric,
    threshold: body.threshold ?? body.event?.threshold,
    timestamp: ensureTimestamp(body.timestamp),
  };
}

export function normalizeEvent(body: any): SentryEvent {
  return {
    event_id: String(body.event_id ?? body.id ?? generateId()),
    issue: parseIssueWebhook(body.issue ?? body),
    user: body.user,
    transaction: body.transaction ?? body.contexts?.trace?.transaction,
    contexts: body.contexts,
    tags: body.tags,
  };
}
