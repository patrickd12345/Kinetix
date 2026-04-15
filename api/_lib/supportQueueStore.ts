import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveKinetixRuntimeEnv } from './env/runtime.js'
import { dispatchTicketNotifications } from './supportNotifications.js'
import { enrichTicketWithDerived, getSlaMetrics } from './supportTicketDerived.js'

type SupportTicketRow = Record<string, any>
type ApprovalDraftRow = Record<string, any>
export const SUPPORT_TICKET_STATUS_OPTIONS = ['open', 'triaged', 'in_progress', 'resolved', 'closed'] as const
export const KB_APPROVAL_TOPIC_OPTIONS = ['account', 'billing', 'sync', 'import', 'kps', 'charts', 'privacy', 'general'] as const
export const KB_APPROVAL_INTENT_OPTIONS = ['howto', 'troubleshoot', 'policy', 'limitation'] as const
export const KB_APPROVAL_REVIEW_STATUS_OPTIONS = ['draft', 'approved', 'ingested', 'rejected'] as const

const SUPPORT_TICKET_STATUS_ALLOWED = new Set<string>(SUPPORT_TICKET_STATUS_OPTIONS)
const KB_APPROVAL_TOPIC_ALLOWED = new Set<string>(KB_APPROVAL_TOPIC_OPTIONS)
const KB_APPROVAL_INTENT_ALLOWED = new Set<string>(KB_APPROVAL_INTENT_OPTIONS)
const KB_APPROVAL_REVIEW_STATUS_ALLOWED = new Set<string>(KB_APPROVAL_REVIEW_STATUS_OPTIONS)

function pickEnv(env: NodeJS.ProcessEnv, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = env[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

function computeSlaDueDatesFromCreatedAt(createdAtIso: string, env: NodeJS.ProcessEnv = process.env) {
  const created = new Date(createdAtIso)
  if (Number.isNaN(created.getTime())) {
    const now = new Date().toISOString()
    return { firstResponseDueAt: now, resolutionDueAt: now }
  }
  const firstRaw = pickEnv(env, ['KINETIX_SUPPORT_SLA_FIRST_RESPONSE_HOURS'], '4')
  const resRaw = pickEnv(env, ['KINETIX_SUPPORT_SLA_RESOLUTION_HOURS'], '72')
  const firstHours = Number.parseInt(String(firstRaw), 10)
  const resHours = Number.parseInt(String(resRaw), 10)
  const firstResponseHours = Number.isFinite(firstHours) && firstHours > 0 ? firstHours : 4
  const resolutionHours = Number.isFinite(resHours) && resHours > 0 ? resHours : 72
  const first = new Date(created.getTime() + firstResponseHours * 60 * 60 * 1000)
  const resolution = new Date(created.getTime() + resolutionHours * 60 * 60 * 1000)
  return {
    firstResponseDueAt: first.toISOString(),
    resolutionDueAt: resolution.toISOString(),
  }
}

function getServiceClient(): SupabaseClient {
  const runtime = resolveKinetixRuntimeEnv()
  if (!runtime.supabaseUrl || !runtime.supabaseServiceRoleKey) {
    throw new Error('Support queue storage is not configured')
  }
  return createClient(runtime.supabaseUrl, runtime.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function toArtifactId(ticketId: string): string {
  return `ticket-resolution-${ticketId}`.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function ticketToDraft(ticket: SupportTicketRow, operatorId: string) {
  const metadata = ticket.metadata && typeof ticket.metadata === 'object' ? ticket.metadata : {}
  const topic = typeof metadata.inferred_topic === 'string' ? metadata.inferred_topic : 'general'
  const excerpt = String(ticket.issue_summary ?? '')
    .trim()
    .slice(0, 500)
  return {
    source_ticket_id: ticket.ticket_id,
    artifact_id: toArtifactId(ticket.ticket_id),
    title: `Support resolution: ${ticket.issue_summary}`,
    excerpt,
    body_markdown: `# ${ticket.issue_summary}\n\n## Problem\n\n${ticket.issue_summary}\n\n## Retrieval context\n\n- Topic: ${String(metadata.inferred_topic ?? 'general')}\n- Retrieval state: ${String(metadata.retrieval_state ?? 'unknown')}\n\n## Resolution\n\nAdd the approved support guidance here.\n`,
    version: 1,
    review_status: 'draft',
    topic,
    intent: 'troubleshoot',
    source_type: 'ticket_resolution',
    product: 'kinetix',
    locale: 'en',
    surface: 'web',
    created_by: operatorId,
    updated_by: operatorId,
  }
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed
}

const MAX_KB_EXCERPT_LEN = 2000

export function validateKbApprovalDraftPatch(
  patch: Partial<
    Pick<ApprovalDraftRow, 'title' | 'body_markdown' | 'excerpt' | 'topic' | 'intent' | 'review_status'>
  >,
) {
  const normalizedPatch: Record<string, string> = {}

  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    const title = normalizeOptionalString(patch.title)
    if (!title) throw new Error('Draft title is required')
    normalizedPatch.title = title
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'body_markdown')) {
    const bodyMarkdown = normalizeOptionalString(patch.body_markdown)
    if (!bodyMarkdown) throw new Error('Draft body markdown is required')
    normalizedPatch.body_markdown = bodyMarkdown
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'excerpt')) {
    const rawExcerpt = patch.excerpt
    if (rawExcerpt !== null && rawExcerpt !== undefined && typeof rawExcerpt !== 'string') {
      throw new Error('Draft excerpt must be a string')
    }
    const excerpt = typeof rawExcerpt === 'string' ? rawExcerpt.trim() : ''
    if (excerpt.length > MAX_KB_EXCERPT_LEN) {
      throw new Error(`Draft excerpt must be at most ${MAX_KB_EXCERPT_LEN} characters`)
    }
    normalizedPatch.excerpt = excerpt
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'topic')) {
    const topic = normalizeOptionalString(patch.topic)
    if (!topic || !KB_APPROVAL_TOPIC_ALLOWED.has(topic)) {
      throw new Error(`Draft topic must be one of: ${KB_APPROVAL_TOPIC_OPTIONS.join(', ')}`)
    }
    normalizedPatch.topic = topic
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'intent')) {
    const intent = normalizeOptionalString(patch.intent)
    if (!intent || !KB_APPROVAL_INTENT_ALLOWED.has(intent)) {
      throw new Error(`Draft intent must be one of: ${KB_APPROVAL_INTENT_OPTIONS.join(', ')}`)
    }
    normalizedPatch.intent = intent
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'review_status')) {
    const reviewStatus = normalizeOptionalString(patch.review_status)
    if (!reviewStatus || !KB_APPROVAL_REVIEW_STATUS_ALLOWED.has(reviewStatus)) {
      throw new Error(`Draft review status must be one of: ${KB_APPROVAL_REVIEW_STATUS_OPTIONS.join(', ')}`)
    }
    normalizedPatch.review_status = reviewStatus
  }

  return normalizedPatch
}

function backfillTicketSlaFields(row: SupportTicketRow): SupportTicketRow {
  const createdAt = typeof row.created_at === 'string' ? row.created_at : null
  if (!createdAt) return row
  const { firstResponseDueAt, resolutionDueAt } = computeSlaDueDatesFromCreatedAt(createdAt)
  return {
    ...row,
    first_response_due_at: row.first_response_due_at ?? firstResponseDueAt,
    resolution_due_at: row.resolution_due_at ?? resolutionDueAt,
  }
}

export function toApiSupportTicket(row: SupportTicketRow | null) {
  if (!row) return null
  const normalized = backfillTicketSlaFields(row)
  return enrichTicketWithDerived(normalized as Record<string, unknown>)
}

export async function listSupportTickets() {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return rows.map((row: SupportTicketRow) => toApiSupportTicket(row)!)
}

export function getSupportTicketSlaMetrics(tickets: Array<Record<string, unknown>>) {
  return getSlaMetrics(tickets)
}

async function fetchSupportTicketRow(ticketId: string) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_tickets')
    .select('*')
    .eq('ticket_id', ticketId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function getSupportTicket(ticketId: string) {
  const row = await fetchSupportTicketRow(ticketId)
  return toApiSupportTicket(row)
}

export async function updateSupportTicket(
  ticketId: string,
  patch: { status?: string; internalNotes?: string; assignedTo?: string | null },
) {
  const supabase = getServiceClient()
  const updatePayload: Record<string, unknown> = {}
  const now = new Date().toISOString()
  let shouldTouchOperator = false

  if (patch.status) {
    if (!SUPPORT_TICKET_STATUS_ALLOWED.has(patch.status)) {
      throw new Error('Invalid support ticket status')
    }
    updatePayload.status = patch.status
    shouldTouchOperator = true
  }
  if (typeof patch.internalNotes === 'string') {
    updatePayload.internal_notes = patch.internalNotes
    shouldTouchOperator = true
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'assignedTo')) {
    const raw = patch.assignedTo
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
      updatePayload.assigned_to = null
      updatePayload.assigned_at = null
    } else if (typeof raw === 'string') {
      updatePayload.assigned_to = raw.trim()
      updatePayload.assigned_at = now
    } else {
      throw new Error('assignedTo must be a string or null')
    }
    shouldTouchOperator = true
  }

  if (shouldTouchOperator) {
    updatePayload.last_operator_action_at = now
  }

  if (Object.keys(updatePayload).length === 0) {
    const existing = await fetchSupportTicketRow(ticketId)
    return toApiSupportTicket(existing)
  }

  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_tickets')
    .update(updatePayload)
    .eq('ticket_id', ticketId)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return toApiSupportTicket(data)
}

export async function retrySupportTicketNotifications(ticketId: string) {
  const supabase = getServiceClient()
  const ticket = await fetchSupportTicketRow(ticketId)
  if (!ticket) return null
  const result = await dispatchTicketNotifications(ticket)
  const touchedAt = new Date().toISOString()
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_tickets')
    .update({
      notification_slack_status: result.slackStatus,
      notification_email_status: result.emailStatus,
      notification_last_attempt_at: result.attemptedAt,
      notification_error_summary: result.errorSummary,
      last_operator_action_at: touchedAt,
    })
    .eq('ticket_id', ticketId)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return toApiSupportTicket(data)
}

export async function moveTicketToKbApprovalBin(ticketId: string, operatorId: string) {
  const supabase = getServiceClient()
  const ticket = await fetchSupportTicketRow(ticketId)
  if (!ticket) return null
  if (ticket.status !== 'resolved') {
    throw new Error('Only resolved tickets can move to the KB approval bin')
  }

  const touchedAt = new Date().toISOString()
  const existing = await getKbApprovalDraftByTicketId(ticketId)
  if (existing) {
    await supabase
      .schema('kinetix')
      .from('support_tickets')
      .update({
        kb_approval_status: 'drafted',
        kb_approval_bin_id: existing.id,
        last_operator_action_at: touchedAt,
      })
      .eq('ticket_id', ticketId)
    return existing
  }

  const draft = ticketToDraft(ticket, operatorId)
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_kb_approval_bin')
    .insert(draft)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) {
    await supabase
      .schema('kinetix')
      .from('support_tickets')
      .update({
        kb_approval_status: 'drafted',
        kb_approval_bin_id: data.id,
        last_operator_action_at: touchedAt,
      })
      .eq('ticket_id', ticketId)
  }
  return data
}

export async function listKbApprovalDrafts() {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_kb_approval_bin')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getKbApprovalDraft(id: string) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_kb_approval_bin')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function getKbApprovalDraftByTicketId(ticketId: string) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_kb_approval_bin')
    .select('*')
    .eq('source_ticket_id', ticketId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function updateKbApprovalDraft(
  id: string,
  patch: Partial<Pick<ApprovalDraftRow, 'title' | 'body_markdown' | 'excerpt' | 'topic' | 'intent' | 'review_status'>>,
  operatorId: string,
) {
  const supabase = getServiceClient()
  const normalizedPatch = validateKbApprovalDraftPatch(patch)
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_kb_approval_bin')
    .update({ ...normalizedPatch, updated_by: operatorId })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function approveAndIngestKbDraft(id: string, operatorId: string) {
  const supabase = getServiceClient()
  const runtime = resolveKinetixRuntimeEnv()
  const draft = await getKbApprovalDraft(id)
  if (!draft) return null
  if (!runtime.kinetixRagBaseUrl) {
    throw new Error('KINETIX_RAG_BASE_URL is not configured')
  }

  const excerpt =
    typeof draft.excerpt === 'string' && draft.excerpt.trim().length > 0 ? String(draft.excerpt).trim() : undefined

  const approveRes = await fetch(`${runtime.kinetixRagBaseUrl.replace(/\/$/, '')}/support/kb/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artifact: {
        artifact_id: draft.artifact_id,
        title: draft.title,
        excerpt,
        body_markdown: draft.body_markdown,
        version: draft.version,
        review_status: 'approved',
        topic: draft.topic,
        intent: draft.intent,
        source_type: draft.source_type,
        product: draft.product,
        locale: draft.locale,
        surface: draft.surface,
      },
    }),
  })
  if (!approveRes.ok) {
    throw new Error(`KB ingest failed (${approveRes.status})`)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_kb_approval_bin')
    .update({
      review_status: 'ingested',
      approved_by: operatorId,
      updated_by: operatorId,
      ingested_at: now,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)

  if (draft.source_ticket_id) {
    await supabase
      .schema('kinetix')
      .from('support_tickets')
      .update({ kb_approval_status: 'ingested' })
      .eq('ticket_id', draft.source_ticket_id)
  }

  return data
}
