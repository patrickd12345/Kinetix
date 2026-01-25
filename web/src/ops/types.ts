export type OpsHealthStatus = 'green' | 'yellow' | 'red';

export type OpsIncident = {
  id: string;
  source: 'internal' | 'sentry' | 'simulation';
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  status: 'open' | 'acknowledged' | 'resolved';
  metadata?: Record<string, unknown>;
};

export type OpsDeployment = {
  id: string;
  version: string;
  environment: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'success' | 'failed';
  source?: 'internal' | 'sentry';
};

export type OpsMetrics = {
  latencyP99?: number;
  errorRate?: number;
  requestRate?: number;
  notes?: string;
};

export type OpsHealthSnapshot = {
  status: OpsHealthStatus;
  summary?: string;
};

export type OpsPredictions = {
  riskFlags: Record<string, boolean>;
  narrative?: string;
};

export type OpsState = {
  health: OpsHealthSnapshot;
  metrics: OpsMetrics;
  incidents: OpsIncident[];
  deployments: OpsDeployment[];
  predictions: OpsPredictions;
};
