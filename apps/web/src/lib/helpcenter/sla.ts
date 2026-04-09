import type { SupportQueueTicket } from '../supportQueueClient'

export type SLAStatus = 'healthy' | 'warning' | 'breached'

function hasOverdueLabel(ticket: SupportQueueTicket) {
  const labels = ticket.derived?.labels ?? []
  return labels.includes('overdue_first_response') || labels.includes('overdue_resolution')
}

export function computeSLAStatus(ticket: SupportQueueTicket): SLAStatus {
  const escalationLevel = ticket.derived?.escalation_level ?? 0
  if (hasOverdueLabel(ticket) || escalationLevel === 2) return 'breached'
  if (escalationLevel === 1) return 'warning'
  return 'healthy'
}

export function computeSLAHealth(tickets: SupportQueueTicket[]): SLAStatus {
  let hasWarning = false
  for (const ticket of tickets) {
    const status = computeSLAStatus(ticket)
    if (status === 'breached') return 'breached'
    if (status === 'warning') hasWarning = true
  }
  return hasWarning ? 'warning' : 'healthy'
}

export function isEscalationNeeded(ticket: SupportQueueTicket) {
  return computeSLAStatus(ticket) !== 'healthy' || (ticket.derived?.escalation_level ?? 0) > 0
}
