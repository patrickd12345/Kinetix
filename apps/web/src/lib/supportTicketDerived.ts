/**
 * Client-side triage helpers. Authoritative derived labels come from the API (`ticket.derived`);
 * these helpers mirror that logic for filtering and sorting.
 */

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

export type SlaMetrics = {
  avg_first_response_ms: number | null
  avg_resolution_ms: number | null
  overdue_count: number
  resolved_last_7_days: number
  created_last_7_days: number
}

export type TriageFilter =
  | 'all'
  | 'urgent'
  | 'escalated'
  | 'unassigned'
  | 'overdue'
  | 'awaiting_retry'
  | 'ready_for_kb'
  | 'assigned_to_me'
  | 'recent'
  | 'stale_resolved'

export function ticketMatchesTriageFilter(
  ticket: { derived?: SupportTicketDerived; assigned_to?: string | null; updated_at?: string | null; status?: string; kb_approval_status?: string | null },
  filter: TriageFilter,
  operatorUserId: string | null,
): boolean {
  if (filter === 'all') return true
  const labels = Array.isArray(ticket.derived?.labels) ? ticket.derived.labels : []
  const has = (label: SupportTicketDerivedLabel) => labels.includes(label)
  const escalationLevel = ticket.derived?.escalation_level ?? 0

  if (filter === 'urgent') {
    return has('overdue_first_response') || has('overdue_resolution') || escalationLevel > 0
  }
  if (filter === 'escalated') {
    return escalationLevel > 0
  }

  if (filter === 'unassigned') return has('unassigned')
  if (filter === 'overdue') return has('overdue_first_response') || has('overdue_resolution')
  if (filter === 'awaiting_retry') return has('awaiting_retry')
  if (filter === 'ready_for_kb') return has('ready_for_kb')
  if (filter === 'assigned_to_me') {
    return Boolean(operatorUserId && ticket.assigned_to === operatorUserId)
  }
  if (filter === 'recent') {
    const t = ticket.updated_at ? Date.parse(ticket.updated_at) : NaN
    if (Number.isNaN(t)) return false
    return Date.now() - t < 24 * 60 * 60 * 1000
  }
  if (filter === 'stale_resolved') {
    const kb = ticket.kb_approval_status ?? 'none'
    if (ticket.status !== 'resolved' || kb === 'ingested') return false
    const t = ticket.updated_at ? Date.parse(ticket.updated_at) : NaN
    if (Number.isNaN(t)) return false
    return Date.now() - t > 7 * 24 * 60 * 60 * 1000
  }
  return true
}
