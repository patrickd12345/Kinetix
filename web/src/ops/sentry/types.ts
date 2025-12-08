export type SentryIssue = {
  id: string;
  title: string;
  culprit?: string;
  project?: string;
  level?: 'info' | 'warning' | 'error' | 'fatal';
  webUrl?: string;
  timestamp: string;
};

export type SentryEvent = {
  event_id: string;
  issue: SentryIssue;
  user?: { id?: string; email?: string };
  transaction?: string;
  contexts?: Record<string, unknown>;
  tags?: Record<string, string>;
};

export type SentryPerformanceEvent = {
  id: string;
  transaction: string;
  op: string;
  duration: number;
  timestamp: string;
};

export type SentryDeploy = {
  environment: string;
  release: string;
  version?: string;
  dateStarted?: string;
  dateFinished?: string;
};

export type SentryAlert = {
  id: string;
  title: string;
  status: 'firing' | 'resolved';
  environment?: string;
  metric?: string;
  threshold?: number;
  timestamp: string;
};
