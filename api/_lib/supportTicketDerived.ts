export type SupportTicketDerivedLabel =
  | 'unassigned'
  | 'assigned'
  | 'overdue_first_response'
  | 'overdue_resolution'
  | 'awaiting_retry'
  | 'ready_for_kb'
  | 'resolved_not_kb'

export type SupportTicketEscalationLevel = 0 | 1 | 2

export type SupportTicketDerived = {
  labels: SupportTicketDerivedLabel[]
  nowIso: string
  escalation_level: SupportTicketEscalationLevel
}

type TicketLike = {
  created_at?: string | null
  updated_at?: string | null
  status: string
  assigned_to?: string | null
  kb_approval_status?: string | null
  notification_slack_status?: string | null
  notification_email_status?: string | null
  first_response_due_at?: string | null
  resolution_due_at?: string | null
  last_operator_action_at?: string | null
}

export type SlaMetrics = {
  avg_first_response_ms: number | null
  avg_resolution_ms: number | null
  overdue_count: number
  resolved_last_7_days: number
  created_last_7_days: number
}

const TERMINAL = new Set(['resolved', 'closed'])
const ACTIVE = new Set(['open', 'triaged', 'in_progress'])
const ESCALATION_LEVEL_1_HOURS = 4
const ESCALATION_LEVEL_2_HOURS = 24
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

function getOverdueReferenceMs(ticket: TicketLike): number | null {
  const firstDue = parseIso(ticket.first_response_due_at ?? null)
  const resolutionDue = parseIso(ticket.resolution_due_at ?? null)
  const lastOperatorActionAt = parseIso(ticket.last_operator_action_at ?? null)
  const status = ticket.status

  const firstResponseComplete =
    lastOperatorActionAt != null || status === 'triaged' || status === 'in_progress' || TERMINAL.has(status)

  if (ACTIVE.has(status) && firstDue != null && !firstResponseComplete) {
    return firstDue
  }

  if (!TERMINAL.has(status) && resolutionDue != null) {
    return resolutionDue
  }

  return null
}

function getEscalationLevel(ticket: TicketLike, now: Date): SupportTicketEscalationLevel {
  const overdueReferenceMs = getOverdueReferenceMs(ticket)
  if (overdueReferenceMs == null) return 0

  const overdueMs = now.getTime() - overdueReferenceMs
  if (overdueMs <= 0) return 0
  if (overdueMs > ESCALATION_LEVEL_2_HOURS * 60 * 60 * 1000) return 2
  if (overdueMs > ESCALATION_LEVEL_1_HOURS * 60 * 60 * 1000) return 1
  return 0
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

/**
 * Derived queue labels layer on top of persisted status; they do not replace status.
 */
export function deriveSupportTicketLabels(ticket: TicketLike, now: Date = new Date()): SupportTicketDerivedLabel[] {
  const labels = new Set<SupportTicketDerivedLabel>()
  const nowMs = now.getTime()

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
  escalated: number
  escalatedLevel2: number
}

function hasLabel(labels: SupportTicketDerivedLabel[], label: SupportTicketDerivedLabel) {
  return labels.includes(label)
}

/**
 * Compact triage counts for operator landing; derived from the same rules as per-ticket labels.
 */
export function computeQueueSummary(
  tickets: Array<{
    created_at?: string | null
    updated_at?: string | null
    derived: SupportTicketDerived
    assigned_to?: string | null
    status?: string
    kb_approval_status?: string | null
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
  let escalated = 0
  let escalatedLevel2 = 0

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
    if (row.derived.escalation_level > 0) {
      escalated += 1
    }
    if (row.derived.escalation_level === 2) {
      escalatedLevel2 += 1
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
    escalated,
    escalatedLevel2,
  }
}

export function getSlaMetrics(
  tickets: Array<{
    created_at?: string | null
    updated_at?: string | null
    status?: string
    derived?: SupportTicketDerived
    last_operator_action_at?: string | null
  }>,
  now: Date = new Date(),
): SlaMetrics {
  const nowMs = now.getTime()
  const sevenDayCutoff = nowMs - SEVEN_DAYS_MS
  const firstResponseDurations: number[] = []
  const resolutionDurations: number[] = []
  let overdueCount = 0
  let resolvedLast7Days = 0
  let createdLast7Days = 0

  for (const ticket of tickets) {
    const createdAtMs = parseIso(ticket.created_at ?? null)

    if (createdAtMs != null && createdAtMs >= sevenDayCutoff) {
      createdLast7Days += 1
    }

    if (
      ticket.derived &&
      (ticket.derived.labels.includes('overdue_first_response') ||
        ticket.derived.labels.includes('overdue_resolution'))
    ) {
      overdueCount += 1
    }

    if (createdAtMs != null) {
      const lastOpAt = ticket.last_operator_action_at
      if (lastOpAt) {
        const lastOperatorActionAtMs = parseIso(lastOpAt)
        if (lastOperatorActionAtMs != null && lastOperatorActionAtMs >= createdAtMs) {
          firstResponseDurations.push(lastOperatorActionAtMs - createdAtMs)
        }
      }

      if (ticket.status === 'resolved') {
        const updatedAt = ticket.updated_at
        if (updatedAt) {
          const updatedAtMs = parseIso(updatedAt)
          if (updatedAtMs != null && updatedAtMs >= createdAtMs) {
            resolutionDurations.push(updatedAtMs - createdAtMs)
            if (updatedAtMs >= sevenDayCutoff) {
              resolvedLast7Days += 1
            }
          }
        }
      }
    }
  }

  return {
    avg_first_response_ms: mean(firstResponseDurations),
    avg_resolution_ms: mean(resolutionDurations),
    overdue_count: overdueCount,
    resolved_last_7_days: resolvedLast7Days,
    created_last_7_days: createdLast7Days,
  }
}

export function enrichTicketWithDerived<T extends Record<string, unknown>>(ticket: T, now: Date = new Date()): T & { derived: SupportTicketDerived } {
  const nowIso = now.toISOString()
  const normalizedTicket = {
    created_at: ticket.created_at as string | null | undefined,
    updated_at: ticket.updated_at as string | null | undefined,
    status: String(ticket.status ?? ''),
    assigned_to: ticket.assigned_to as string | null | undefined,
    kb_approval_status: ticket.kb_approval_status as string | null | undefined,
    notification_slack_status: ticket.notification_slack_status as string | null | undefined,
    notification_email_status: ticket.notification_email_status as string | null | undefined,
    first_response_due_at: ticket.first_response_due_at as string | null | undefined,
    resolution_due_at: ticket.resolution_due_at as string | null | undefined,
    last_operator_action_at: ticket.last_operator_action_at as string | null | undefined,
  }
  const labelList = deriveSupportTicketLabels(normalizedTicket, now)
  const escalationLevel = getEscalationLevel(normalizedTicket, now)
  return { ...ticket, derived: { labels: labelList, nowIso, escalation_level: escalationLevel } }
}
