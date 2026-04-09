import type { Session } from '@supabase/supabase-js'

import type { QueueSummary, SlaMetrics, SupportTicketDerived } from './supportTicketDerived'

type HttpMethod = 'GET' | 'PATCH' | 'POST'

export interface SupportQueueTicket {
  ticket_id: string
  status: string
  severity: string | null
  issue_summary: string
  internal_notes: string
  notification_slack_status: string
  notification_email_status: string
  notification_error_summary: string
  notification_last_attempt_at: string | null
  kb_approval_status: string
  created_at: string
  updated_at: string
  assigned_to?: string | null
  assigned_at?: string | null
  first_response_due_at?: string | null
  resolution_due_at?: string | null
  last_operator_action_at?: string | null
  metadata: Record<string, unknown> | null
  derived?: SupportTicketDerived
}

export interface SupportQueueListPayload {
  tickets: SupportQueueTicket[]
  summary: QueueSummary
  slaMetrics: SlaMetrics
}

export interface SupportKbApprovalDraft {
  id: string
  source_ticket_id: string | null
  artifact_id: string
  title: string
  excerpt?: string
  body_markdown: string
  review_status: string
  topic: string
  intent: string
  updated_at: string
}

export type { QueueSummary }
export type { SlaMetrics }

async function supportQueueRequest<T>(
  session: Session | null,
  path: string,
  options: { method?: HttpMethod; body?: Record<string, unknown> } = {},
): Promise<T> {
  const token = session?.access_token
  if (!token) {
    throw new Error('Authentication is required')
  }

  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`)
  }
  return data
}

export async function listSupportQueueTickets(session: Session | null) {
  const data = await supportQueueRequest<SupportQueueListPayload>(
    session,
    '/api/support-queue/tickets',
  )
  return data
}

export async function getSupportQueueTicket(session: Session | null, ticketId: string) {
  const data = await supportQueueRequest<{ ticket: SupportQueueTicket }>(
    session,
    `/api/support-queue/tickets/${encodeURIComponent(ticketId)}`,
  )
  return data.ticket
}

export async function updateSupportQueueTicket(
  session: Session | null,
  ticketId: string,
  patch: { status?: string; internalNotes?: string; assignedTo?: string | null },
) {
  const data = await supportQueueRequest<{ ticket: SupportQueueTicket }>(
    session,
    `/api/support-queue/tickets/${encodeURIComponent(ticketId)}`,
    { method: 'PATCH', body: patch },
  )
  return data.ticket
}

export async function retrySupportQueueNotifications(session: Session | null, ticketId: string) {
  const data = await supportQueueRequest<{ ticket: SupportQueueTicket }>(
    session,
    `/api/support-queue/tickets/${encodeURIComponent(ticketId)}/retry-notifications`,
    { method: 'POST' },
  )
  return data.ticket
}

export async function moveTicketToKbApprovalBin(session: Session | null, ticketId: string) {
  const data = await supportQueueRequest<{ draft: SupportKbApprovalDraft }>(
    session,
    `/api/support-queue/tickets/${encodeURIComponent(ticketId)}/move-to-kb-bin`,
    { method: 'POST' },
  )
  return data.draft
}

export async function listKbApprovalDrafts(session: Session | null) {
  const data = await supportQueueRequest<{ drafts: SupportKbApprovalDraft[] }>(session, '/api/support-queue/kb-approval')
  return data.drafts
}

export async function getKbApprovalDraft(session: Session | null, draftId: string) {
  const data = await supportQueueRequest<{ draft: SupportKbApprovalDraft }>(
    session,
    `/api/support-queue/kb-approval/${encodeURIComponent(draftId)}`,
  )
  return data.draft
}

export async function updateKbApprovalDraft(
  session: Session | null,
  draftId: string,
  patch: Partial<Pick<SupportKbApprovalDraft, 'title' | 'excerpt' | 'body_markdown' | 'topic' | 'intent' | 'review_status'>>,
) {
  const data = await supportQueueRequest<{ draft: SupportKbApprovalDraft }>(
    session,
    `/api/support-queue/kb-approval/${encodeURIComponent(draftId)}`,
    { method: 'PATCH', body: patch },
  )
  return data.draft
}

export async function approveAndIngestKbApprovalDraft(session: Session | null, draftId: string) {
  const data = await supportQueueRequest<{ draft: SupportKbApprovalDraft }>(
    session,
    `/api/support-queue/kb-approval/${encodeURIComponent(draftId)}/approve-ingest`,
    { method: 'POST' },
  )
  return data.draft
}
