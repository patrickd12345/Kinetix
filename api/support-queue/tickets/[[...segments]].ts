import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../../_lib/cors.js'
import { sendApiError } from '../../_lib/apiError.js'
import { requireSupportOperator } from '../../_lib/supportOperator.js'
import { computeQueueSummary } from '../../_lib/supportTicketDerived.js'
import {
  getSupportTicket,
  listSupportTickets,
  moveTicketToKbApprovalBin,
  retrySupportTicketNotifications,
  updateSupportTicket,
} from '../../_lib/supportQueueStore.js'

function normalizeSegments(query: VercelRequest['query']): string[] {
  const raw = query.segments
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  return [String(raw)]
}

function isTicketStatusValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message === 'Invalid support ticket status'
}

function isKbBinValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message === 'Only resolved tickets can move to the KB approval bin'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = normalizeSegments(req.query)

  if (segments.length === 0) {
    const cors = applyCors(req, res, {
      methods: ['GET', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    })
    if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'GET') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

    const operator = await requireSupportOperator(req)
    if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

    try {
      const tickets = await listSupportTickets()
      const summary = computeQueueSummary(tickets, { operatorUserId: operator.id })
      return res.status(200).json({ ok: true, tickets, summary })
    } catch (error) {
      return sendApiError(res, 503, 'Support queue unavailable', {
        source: req.headers,
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (segments.length === 1) {
    const cors = applyCors(req, res, {
      methods: ['GET', 'PATCH', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    })
    if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
    if (req.method === 'OPTIONS') return res.status(200).end()

    const operator = await requireSupportOperator(req)
    if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

    const ticketId = segments[0]
    if (!ticketId) return sendApiError(res, 400, 'ticketId is required', { source: req.headers })

    try {
      if (req.method === 'GET') {
        const ticket = await getSupportTicket(ticketId)
        if (!ticket) return sendApiError(res, 404, 'Ticket not found', { source: req.headers })
        return res.status(200).json({ ok: true, ticket })
      }

      if (req.method === 'PATCH') {
        const body = (req.body ?? {}) as { status?: string; internalNotes?: string; assignedTo?: string | null }
        const ticket = await updateSupportTicket(ticketId, body)
        if (!ticket) return sendApiError(res, 404, 'Ticket not found', { source: req.headers })
        return res.status(200).json({ ok: true, ticket })
      }

      return sendApiError(res, 405, 'Method not allowed', { source: req.headers })
    } catch (error) {
      if (isTicketStatusValidationError(error)) {
        return sendApiError(res, 400, error.message, { source: req.headers })
      }
      if (error instanceof Error && (error.message.startsWith('assignedTo') || error.message.includes('assignedTo'))) {
        return sendApiError(res, 400, error.message, { source: req.headers })
      }
      return sendApiError(res, 503, 'Support queue unavailable', {
        source: req.headers,
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (segments.length === 2) {
    const cors = applyCors(req, res, {
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    })
    if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

    const operator = await requireSupportOperator(req)
    if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

    const [ticketId, action] = segments
    if (!ticketId) return sendApiError(res, 400, 'ticketId is required', { source: req.headers })

    if (action === 'move-to-kb-bin') {
      try {
        const draft = await moveTicketToKbApprovalBin(ticketId, operator.id)
        if (!draft) return sendApiError(res, 404, 'Ticket not found', { source: req.headers })
        return res.status(200).json({ ok: true, draft })
      } catch (error) {
        if (isKbBinValidationError(error)) {
          return sendApiError(res, 400, error.message, { source: req.headers })
        }
        return sendApiError(res, 503, 'KB approval bin unavailable', {
          source: req.headers,
          details: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (action === 'retry-notifications') {
      try {
        const ticket = await retrySupportTicketNotifications(ticketId)
        if (!ticket) return sendApiError(res, 404, 'Ticket not found', { source: req.headers })
        return res.status(200).json({ ok: true, ticket })
      } catch (error) {
        return sendApiError(res, 503, 'Notification retry unavailable', {
          source: req.headers,
          details: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return sendApiError(res, 404, 'Not found', { source: req.headers })
  }

  return sendApiError(res, 404, 'Not found', { source: req.headers })
}
