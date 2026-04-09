import type { SupportQueueTicket } from '../supportQueueClient'
import { featureFlags } from '../featureFlags'
import { sendEscalationNotification } from './notify'
import { isEscalationNeeded } from './sla'

const notified = new Set<string>()

function parseCreatedAt(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : NaN
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

export function compareEscalations(a: SupportQueueTicket, b: SupportQueueTicket) {
  const levelDiff = (b.derived?.escalation_level ?? 0) - (a.derived?.escalation_level ?? 0)
  if (levelDiff !== 0) return levelDiff

  const createdDiff = parseCreatedAt(a.created_at) - parseCreatedAt(b.created_at)
  if (createdDiff !== 0) return createdDiff

  return a.ticket_id.localeCompare(b.ticket_id)
}

export function notifyEscalation(ticket: SupportQueueTicket) {
  if (!featureFlags.ENABLE_ESCALATION) return
  if (notified.has(ticket.ticket_id)) return
  notified.add(ticket.ticket_id)
  console.info('Escalation triggered', ticket.ticket_id)
  void sendEscalationNotification({
    ticketId: ticket.ticket_id,
    escalationLevel: ticket.derived?.escalation_level ?? 0,
    title: ticket.issue_summary,
    createdAt: ticket.created_at,
    assignee: ticket.assigned_to ?? undefined,
    labels: ticket.derived?.labels ?? undefined,
  })
}

export function checkEscalations(tickets: SupportQueueTicket[]) {
  return tickets.filter(isEscalationNeeded).sort(compareEscalations)
}

export function __resetEscalationNotificationStateForTests() {
  notified.clear()
}
