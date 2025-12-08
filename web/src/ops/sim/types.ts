export type SimulationScenarioName =
  | 'healthy'
  | 'null_deployments'
  | 'latency_spike'
  | 'error_spike'
  | 'db_down'
  | 'worker_overload'
  | 'sentry_issue_storm';

export type SimulationScenario = {
  name: SimulationScenarioName;
  description: string;
  apply: (context: any) => any;
};
