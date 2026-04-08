import { resolveKinetixRuntimeEnv } from './env/runtime.js'

export type NotificationChannelStatus = 'pending' | 'sent' | 'failed' | 'unconfigured'

export interface TicketNotificationDispatchResult {
  slackStatus: NotificationChannelStatus
  emailStatus: NotificationChannelStatus
  attemptedAt: string
  errorSummary: string
}

function queueUrl(ticketId: string): string {
  const base = resolveKinetixRuntimeEnv().kinetixAppBaseUrl || 'https://kinetix.bookiji.com'
  return `${base.replace(/\/$/, '')}/support-queue?ticketId=${encodeURIComponent(ticketId)}`
}

async function notifySlack(ticket: Record<string, any>) {
  const webhookUrl = resolveKinetixRuntimeEnv().kinetixSupportSlackWebhookUrl
  if (!webhookUrl) return { status: 'unconfigured' as const, error: '' }
  const metadata = ticket.metadata && typeof ticket.metadata === 'object' ? ticket.metadata : {}
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Kinetix support ticket ${ticket.ticket_id}: ${ticket.issue_summary}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New Kinetix support ticket*\n*Ticket:* ${ticket.ticket_id}\n*Summary:* ${ticket.issue_summary}\n*Topic:* ${String(metadata.inferred_topic ?? 'general')}\n*Retrieval:* ${String(metadata.retrieval_state ?? 'unknown')}\n*Severity:* ${String(ticket.severity ?? 'unknown')}`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Open support queue' },
                url: queueUrl(ticket.ticket_id),
              },
            ],
          },
        ],
      }),
    })
    return res.ok
      ? { status: 'sent' as const, error: '' }
      : { status: 'failed' as const, error: `slack:${res.status}` }
  } catch {
    return { status: 'failed' as const, error: 'slack:network' }
  }
}

async function notifyEmail(ticket: Record<string, any>) {
  const runtime = resolveKinetixRuntimeEnv()
  if (!runtime.resendApiKey || !runtime.kinetixSupportEmailFrom || !runtime.kinetixSupportEmailTo) {
    return { status: 'unconfigured' as const, error: '' }
  }
  const metadata = ticket.metadata && typeof ticket.metadata === 'object' ? ticket.metadata : {}
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runtime.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: runtime.kinetixSupportEmailFrom,
        to: [runtime.kinetixSupportEmailTo],
        subject: `Kinetix support ticket ${ticket.ticket_id}`,
        html: `<p><strong>New Kinetix support ticket</strong></p><p><strong>Ticket:</strong> ${ticket.ticket_id}<br/><strong>Summary:</strong> ${ticket.issue_summary}<br/><strong>Topic:</strong> ${String(metadata.inferred_topic ?? 'general')}<br/><strong>Retrieval:</strong> ${String(metadata.retrieval_state ?? 'unknown')}<br/><strong>Severity:</strong> ${String(ticket.severity ?? 'unknown')}</p><p><a href="${queueUrl(ticket.ticket_id)}">Open support queue</a></p>`,
      }),
    })
    return res.ok
      ? { status: 'sent' as const, error: '' }
      : { status: 'failed' as const, error: `email:${res.status}` }
  } catch {
    return { status: 'failed' as const, error: 'email:network' }
  }
}

export async function dispatchTicketNotifications(ticket: Record<string, any>): Promise<TicketNotificationDispatchResult> {
  const attemptedAt = new Date().toISOString()
  const [slack, email] = await Promise.all([notifySlack(ticket), notifyEmail(ticket)])
  return {
    slackStatus: slack.status,
    emailStatus: email.status,
    attemptedAt,
    errorSummary: [slack.error, email.error].filter(Boolean).join('; '),
  }
}
