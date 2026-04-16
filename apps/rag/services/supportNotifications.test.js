import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchSupportNotifications } from './supportNotifications.js';

test('dispatchSupportNotifications returns unconfigured when no channels configured', async () => {
  const result = await dispatchSupportNotifications({}, {
    ticket_id: 'kinetix-20260408-abcdef',
    issue_summary: 'Support request',
    severity: 'unknown',
    metadata: {},
  });

  assert.equal(result.slackStatus, 'unconfigured');
  assert.equal(result.emailStatus, 'unconfigured');
  assert.equal(result.errorSummary, '');
});

test('dispatchSupportNotifications records channel failures without throwing', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => ({
    ok: false,
    status: String(url).includes('resend') ? 502 : 500,
  });

  try {
    const result = await dispatchSupportNotifications(
      {
        kinetixSupportSlackWebhookUrl: 'https://slack.test/webhook',
        resendApiKey: 're_test',
        kinetixSupportEmailTo: 'ops@kinetix.test',
        kinetixSupportEmailFrom: 'Kinetix <support@kinetix.test>',
        kinetixAppBaseUrl: 'https://kinetix.test',
      },
      {
        ticket_id: 'kinetix-20260408-abcdef',
        issue_summary: 'Support request',
        severity: 'medium',
        metadata: { inferred_topic: 'sync', retrieval_state: 'retrieval_weak' },
      },
    );

    assert.equal(result.slackStatus, 'failed');
    assert.equal(result.emailStatus, 'failed');
    assert.match(result.errorSummary, /slack:500/);
    assert.match(result.errorSummary, /email:502/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('dispatchSupportNotifications converts network errors into failed channel states', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network down');
  };

  try {
    const result = await dispatchSupportNotifications(
      {
        kinetixSupportSlackWebhookUrl: 'https://slack.test/webhook',
        resendApiKey: 're_test',
        kinetixSupportEmailTo: 'ops@kinetix.test',
        kinetixSupportEmailFrom: 'Kinetix <support@kinetix.test>',
        kinetixAppBaseUrl: 'https://kinetix.test',
      },
      {
        ticket_id: 'kinetix-20260408-abcdef',
        issue_summary: 'Support request',
        severity: 'medium',
        metadata: { inferred_topic: 'sync', retrieval_state: 'retrieval_weak' },
      },
    );

    assert.equal(result.slackStatus, 'failed');
    assert.equal(result.emailStatus, 'failed');
    assert.match(result.errorSummary, /slack:network/);
    assert.match(result.errorSummary, /email:network/);
  } finally {
    global.fetch = originalFetch;
  }
});
