export type SupportTicketDerivedLabel =
  | 'unassigned'
  | 'assigned'
  | 'overdue_first_response'
  | 'overdue_resolution'
  | 'awaiting_retry'
  | 'ready_for_kb'
  | 'resolved_not_kb'

export type SupportTicketDerived = {
  labels: SupportTicketDerivedLabel[]
  nowIso: string
}

type TicketLike = {
  status: string
  assigned_to?: string | null
  kb_approval_status?: string | null
  notification_slack_status?: string | null
  notification_email_status?: string | null
  first_response_due_at?: string | null
  resolution_due_at?: string | null
  last_operator_action_at?: string | null
}

const TERMINAL = new Set(['resolved', 'closed'])
const ACTIVE = new Set(['open', 'triaged', 'in_progress'])

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

/**
 * Derived queue labels layer on top of persisted status; they do not replace status.
 */
export function deriveSupportTicketLabels(ticket: TicketLike, now: Date = new Date()): SupportTicketDerivedLabel[] {
  const labels = new Set<SupportTicketDerivedLabel>()
  const nowMs = now.getTime()
  const nowIso = now.toISOString()

  const assigned = typeof ticket.assigned_to === 'string' && ticket.assigned_to.trim().length > 0
  if (assigned) {
    labels.add('assigned')
  } else {
    labels.add('unassigned')
  }

  const slackFailed = ticket.notification_slack_status === 'failed'
  const emailFailed = ticket.notification_email_status === 'failed'
  if (slackFailed || emailFailed) {
    labels.add('awaiting_retry')
  }

  const status = ticket.status
  const firstDue = parseIso(ticket.first_response_due_at ?? null)
  const resDue = parseIso(ticket.resolution_due_at ?? null)
  const lastOp = parseIso(ticket.last_operator_action_at ?? null)

  const firstResponseComplete = lastOp != null || status === 'triaged' || status === 'in_progress' || TERMINAL.has(status)

  if (ACTIVE.has(status) && firstDue != null && nowMs > firstDue && !firstResponseComplete) {
    labels.add('overdue_first_response')
  }

  if (!TERMINAL.has(status) && resDue != null && nowMs > resDue) {
    labels.add('overdue_resolution')
  }

  const kb = ticket.kb_approval_status ?? 'none'
  if (status === 'resolved' && (kb === 'none' || kb === 'candidate')) {
    labels.add('ready_for_kb')
  }

  if (status === 'resolved' && kb !== 'ingested') {
    labels.add('resolved_not_kb')
  }

  return Array.from(labels)
}

export type QueueSummary = {
  unassigned: number
  overdue: number
  awaitingRetry: number
  readyForKb: number
  assignedToMe: number
  staleResolvedNotKb: number
  recentlyUpdated: number
}

function hasLabel(labels: SupportTicketDerivedLabel[], label: SupportTicketDerivedLabel) {
  return labels.includes(label)
}

/**
 * Compact triage counts for operator landing; derived from the same rules as per-ticket labels.
 */
export function computeQueueSummary(
  tickets: Array<{
    derived: SupportTicketDerived
    assigned_to?: string | null
    status?: string
    kb_approval_status?: string | null
    updated_at?: string | null
  }>,
  options: { operatorUserId?: string; recentHours?: number; staleResolvedDays?: number } = {},
): QueueSummary {
  const operatorUserId = options.operatorUserId
  const recentHours = options.recentHours ?? 24
  const staleResolvedDays = options.staleResolvedDays ?? 7
  const nowMs = Date.now()
  const recentCutoff = nowMs - recentHours * 60 * 60 * 1000
  const staleCutoff = nowMs - staleResolvedDays * 24 * 60 * 60 * 1000

  let unassigned = 0
  let overdue = 0
  let awaitingRetry = 0
  let readyForKb = 0
  let assignedToMe = 0
  let staleResolvedNotKb = 0
  let recentlyUpdated = 0

  for (const row of tickets) {
    const labels = row.derived.labels
    const assigned = typeof row.assigned_to === 'string' && row.assigned_to.trim().length > 0
    if (!assigned) {
      unassigned += 1
    }
    if (hasLabel(labels, 'overdue_first_response') || hasLabel(labels, 'overdue_resolution')) {
      overdue += 1
    }
    if (hasLabel(labels, 'awaiting_retry')) {
      awaitingRetry += 1
    }
    if (hasLabel(labels, 'ready_for_kb')) {
      readyForKb += 1
    }
    if (operatorUserId && row.assigned_to === operatorUserId) {
      assignedToMe += 1
    }
    const updatedAt = row.updated_at ? Date.parse(row.updated_at) : NaN
    if (!Number.isNaN(updatedAt) && updatedAt >= recentCutoff) {
      recentlyUpdated += 1
    }
    const kb = row.kb_approval_status ?? 'none'
    if (
      row.status === 'resolved' &&
      kb !== 'ingested' &&
      !Number.isNaN(updatedAt) &&
      updatedAt < staleCutoff
    ) {
      staleResolvedNotKb += 1
    }
  }

  return {
    unassigned,
    overdue,
    awaitingRetry,
    readyForKb,
    assignedToMe,
    staleResolvedNotKb,
    recentlyUpdated,
  }
}

export function enrichTicketWithDerived<T extends Record<string, unknown>>(ticket: T, now: Date = new Date()): T & { derived: SupportTicketDerived } {
  const nowIso = now.toISOString()
  const labelList = deriveSupportTicketLabels(
    {
      status: String(ticket.status ?? ''),
      assigned_to: ticket.assigned_to as string | null | undefined,
      kb_approval_status: ticket.kb_approval_status as string | null | undefined,
      notification_slack_status: ticket.notification_slack_status as string | null | undefined,
      notification_email_status: ticket.notification_email_status as string | null | undefined,
      first_response_due_at: ticket.first_response_due_at as string | null | undefined,
      resolution_due_at: ticket.resolution_due_at as string | null | undefined,
      last_operator_action_at: ticket.last_operator_action_at as string | null | undefined,
    },
    now,
  )
  return { ...ticket, derived: { labels: labelList, nowIso } }
}
