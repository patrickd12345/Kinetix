import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors.js'
import { sendApiError } from '../_lib/apiError.js'
import { requireSupportOperator } from '../_lib/supportOperator.js'
import { computeQueueSummary } from '../_lib/supportTicketDerived.js'
import {
  approveAndIngestKbDraft,
  getKbApprovalDraft,
  getSupportTicket,
  getSupportTicketSlaMetrics,
  listKbApprovalDrafts,
  listSupportTickets,
  moveTicketToKbApprovalBin,
  retrySupportTicketNotifications,
  updateKbApprovalDraft,
  updateSupportTicket,
} from '../_lib/supportQueueStore.js'

function normalizeSegments(req: VercelRequest): string[] {
  const raw = req.query.segments
  if (raw != null) {
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
    return [String(raw)]
  }
  const pathname = (req.url ?? '').split('?')[0] ?? ''
  const m = /^\/api\/support-queue\/?(.*)$/.exec(pathname)
  if (!m) return []
  const tail = m[1] ?? ''
  if (!tail) return []
  return tail.split('/').filter(Boolean)
}

function isTicketStatusValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message === 'Invalid support ticket status'
}

function isKbBinValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message === 'Only resolved tickets can move to the KB approval bin'
}

function isKbDraftValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith('Draft ')
}

async function handleTickets(req: VercelRequest, res: VercelResponse, sub: string[]) {
  if (sub.length === 0) {
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
      const slaMetrics = getSupportTicketSlaMetrics(tickets)
      return res.status(200).json({ ok: true, tickets, summary, slaMetrics })
    } catch (error) {
      return sendApiError(res, 503, 'Support queue unavailable', {
        source: req.headers,
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (sub.length === 1) {
    const cors = applyCors(req, res, {
      methods: ['GET', 'PATCH', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    })
    if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
    if (req.method === 'OPTIONS') return res.status(200).end()

    const operator = await requireSupportOperator(req)
    if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

    const ticketId = sub[0]
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

  if (sub.length === 2) {
    const cors = applyCors(req, res, {
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    })
    if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

    const operator = await requireSupportOperator(req)
    if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

    const [ticketId, action] = sub
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

async function handleKbApproval(req: VercelRequest, res: VercelResponse, sub: string[]) {
  if (sub.length === 0) {
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
      const drafts = await listKbApprovalDrafts()
      return res.status(200).json({ ok: true, drafts })
    } catch (error) {
      return sendApiError(res, 503, 'KB approval queue unavailable', {
        source: req.headers,
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (sub.length === 1) {
    const cors = applyCors(req, res, {
      methods: ['GET', 'PATCH', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    })
    if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
    if (req.method === 'OPTIONS') return res.status(200).end()

    const operator = await requireSupportOperator(req)
    if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

    const draftId = sub[0]
    if (!draftId) return sendApiError(res, 400, 'draftId is required', { source: req.headers })

    try {
      if (req.method === 'GET') {
        const draft = await getKbApprovalDraft(draftId)
        if (!draft) return sendApiError(res, 404, 'Draft not found', { source: req.headers })
        return res.status(200).json({ ok: true, draft })
      }

      if (req.method === 'PATCH') {
        const body = (req.body ?? {}) as {
          title?: string
          body_markdown?: string
          excerpt?: string
          topic?: string
          intent?: string
          review_status?: string
        }
        const draft = await updateKbApprovalDraft(draftId, body, operator.id)
        if (!draft) return sendApiError(res, 404, 'Draft not found', { source: req.headers })
        return res.status(200).json({ ok: true, draft })
      }

      return sendApiError(res, 405, 'Method not allowed', { source: req.headers })
    } catch (error) {
      if (isKbDraftValidationError(error)) {
        return sendApiError(res, 400, error.message, { source: req.headers })
      }
      return sendApiError(res, 503, 'KB approval queue unavailable', {
        source: req.headers,
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (sub.length === 2 && sub[1] === 'approve-ingest') {
    const cors = applyCors(req, res, {
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
    })
    if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

    const operator = await requireSupportOperator(req)
    if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

    const draftId = sub[0]
    if (!draftId) return sendApiError(res, 400, 'draftId is required', { source: req.headers })

    try {
      const draft = await approveAndIngestKbDraft(draftId, operator.id)
      if (!draft) return sendApiError(res, 404, 'Draft not found', { source: req.headers })
      return res.status(200).json({ ok: true, draft })
    } catch (error) {
      return sendApiError(res, 503, 'KB ingest unavailable', {
        source: req.headers,
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return sendApiError(res, 404, 'Not found', { source: req.headers })
}

/**
 * Single Hobby-plan serverless entry for all `/api/support-queue/*` routes.
 * Nested `tickets/[[...segments]]` did not bind `GET /api/support-queue/tickets` (directory root);
 * the SPA rewrite masked that. Top-level catch-all + SPA exclusion fixes routing.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const full = normalizeSegments(req)
  if (full.length === 0) {
    return sendApiError(res, 404, 'Not found', { source: req.headers })
  }
  const head = full[0]
  const rest = full.slice(1)
  if (head === 'tickets') return handleTickets(req, res, rest)
  if (head === 'kb-approval') return handleKbApproval(req, res, rest)
  return sendApiError(res, 404, 'Not found', { source: req.headers })
}
