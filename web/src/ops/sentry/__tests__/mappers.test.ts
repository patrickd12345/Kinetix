import { describe, expect, it } from 'vitest';
import { sentryAlertToIncidentOrPlaybookTrigger, sentryDeployToDeployment, sentryIssueToIncident } from '../mappers';

describe('sentry mappers', () => {
  it('maps issue to incident', () => {
    const incident = sentryIssueToIncident({
      id: '1',
      title: 'API failure',
      timestamp: new Date().toISOString(),
      level: 'error',
    });
    expect(incident.source).toBe('sentry');
    expect(incident.severity).toBe('high');
  });

  it('maps deploy to deployment', () => {
    const deployment = sentryDeployToDeployment({
      environment: 'production',
      release: '1.2.3',
    });
    expect(deployment.source).toBe('sentry');
    expect(deployment.status).toBe('success');
  });

  it('maps alert to incident and playbook trigger', () => {
    const mapped = sentryAlertToIncidentOrPlaybookTrigger({
      id: 'alert-1',
      title: 'Latency high',
      status: 'firing',
      metric: 'latency',
      timestamp: new Date().toISOString(),
    });
    expect(mapped.incident?.source).toBe('sentry');
    expect(mapped.playbookTrigger?.playbook).toContain('latency');
  });
});
