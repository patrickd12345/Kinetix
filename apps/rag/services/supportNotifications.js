/**
 * Post-create notification fan-out for Kinetix support tickets.
 * Ticket persistence is authoritative; notification failure must never roll it back.
 */

/**
 * @typedef {'pending' | 'sent' | 'failed' | 'unconfigured'} NotificationChannelStatus
 */

/**
 * @typedef {{
 *   slackStatus: NotificationChannelStatus
 *   emailStatus: NotificationChannelStatus
 *   attemptedAt: string
 *   errorSummary: string
 * }} NotificationDispatchResult
 */

function trimOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function supportQueueUrl(env, ticketId) {
  const base = trimOrEmpty(env.kinetixAppBaseUrl) || 'https://kinetix.bookiji.com';
  return `${base.replace(/\/$/, '')}/support-queue?ticketId=${encodeURIComponent(ticketId)}`;
}

function buildNotificationSummary(ticketRow, issueSummary) {
  const metadata = ticketRow.metadata && typeof ticketRow.metadata === 'object' ? ticketRow.metadata : {};
  const topic = typeof metadata.inferred_topic === 'string' ? metadata.inferred_topic : 'general';
  const retrieval = typeof metadata.retrieval_state === 'string' ? metadata.retrieval_state : 'unknown';
  return { topic, retrieval, summary: issueSummary };
}

async function sendSlackNotification(env, ticketRow, issueSummary) {
  const webhookUrl = trimOrEmpty(env.kinetixSupportSlackWebhookUrl);
  if (!webhookUrl) {
    return { status: 'unconfigured', error: null };
  }

  const info = buildNotificationSummary(ticketRow, issueSummary);
  const queueUrl = supportQueueUrl(env, ticketRow.ticket_id);
  const payload = {
    text: `Kinetix support ticket ${ticketRow.ticket_id}: ${issueSummary}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*New Kinetix support ticket*\n*Ticket:* ${ticketRow.ticket_id}\n*Summary:* ${issueSummary}\n*Topic:* ${info.topic}\n*Retrieval:* ${info.retrieval}\n*Severity:* ${ticketRow.severity}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open support queue' },
            url: queueUrl,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { status: 'failed', error: `slack:${res.status}` };
    }
    return { status: 'sent', error: null };
  } catch {
    return { status: 'failed', error: 'slack:network' };
  }
}

async function sendEmailNotification(env, ticketRow, issueSummary) {
  const apiKey = trimOrEmpty(env.resendApiKey);
  const to = trimOrEmpty(env.kinetixSupportEmailTo);
  const from = trimOrEmpty(env.kinetixSupportEmailFrom);
  if (!apiKey || !to || !from) {
    return { status: 'unconfigured', error: null };
  }

  const info = buildNotificationSummary(ticketRow, issueSummary);
  const queueUrl = supportQueueUrl(env, ticketRow.ticket_id);
  const html = [
    `<p><strong>New Kinetix support ticket</strong></p>`,
    `<p><strong>Ticket:</strong> ${ticketRow.ticket_id}<br/>`,
    `<strong>Summary:</strong> ${issueSummary}<br/>`,
    `<strong>Topic:</strong> ${info.topic}<br/>`,
    `<strong>Retrieval:</strong> ${info.retrieval}<br/>`,
    `<strong>Severity:</strong> ${ticketRow.severity}</p>`,
    `<p><a href="${queueUrl}">Open support queue</a></p>`,
  ].join('');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Kinetix support ticket ${ticketRow.ticket_id}`,
        html,
      }),
    });

    if (!res.ok) {
      return { status: 'failed', error: `email:${res.status}` };
    }
    return { status: 'sent', error: null };
  } catch {
    return { status: 'failed', error: 'email:network' };
  }
}

/**
 * @param {Record<string, string>} env
 * @param {Record<string, unknown>} ticketRow
 * @returns {Promise<NotificationDispatchResult>}
 */
export async function dispatchSupportNotifications(env, ticketRow) {
  const attemptedAt = new Date().toISOString();
  const issueSummary = typeof ticketRow.issue_summary === 'string' ? ticketRow.issue_summary : 'Support request';

  const [slack, email] = await Promise.all([
    sendSlackNotification(env, ticketRow, issueSummary),
    sendEmailNotification(env, ticketRow, issueSummary),
  ]);

  const errors = [slack.error, email.error].filter(Boolean);
  return {
    slackStatus: slack.status,
    emailStatus: email.status,
    attemptedAt,
    errorSummary: errors.join('; '),
  };
}
