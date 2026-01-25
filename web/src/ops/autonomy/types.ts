export type OpsComponent = 'api' | 'worker' | 'scheduler' | 'cron' | 'simcity';

export type ActionType =
  | 'restart_component'
  | 'trigger_synthetic'
  | 'run_playbook'
  | 'raise_incident'
  | 'set_risk_flag';

export type AutonomousAction = {
  id: string;
  type: ActionType;
  target?: OpsComponent | string;
  reason: string;
  createdAt: string;
  executedAt?: string;
  status: 'pending' | 'executed' | 'skipped' | 'failed';
  metadata?: Record<string, any>;
};

export type AutonomyContext = {
  health: any;
  metrics: any;
  incidents: any[];
  deployments: any[];
  predictions: any;
};
