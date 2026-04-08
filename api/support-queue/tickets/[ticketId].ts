import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../../_lib/cors.js'
import { sendApiError } from '../../_lib/apiError.js'
import { requireSupportOperator } from '../../_lib/supportOperator.js'
import { getSupportTicket, updateSupportTicket } from '../../_lib/supportQueueStore.js'

function isValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message === 'Invalid support ticket status'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['GET', 'PATCH', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
  })
  if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  if (req.method === 'OPTIONS') return res.status(200).end()

  const operator = await requireSupportOperator(req)
  if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

  const ticketId = typeof req.query.ticketId === 'string' ? req.query.ticketId : ''
  if (!ticketId) return sendApiError(res, 400, 'ticketId is required', { source: req.headers })

  try {
    if (req.method === 'GET') {
      const ticket = await getSupportTicket(ticketId)
      if (!ticket) return sendApiError(res, 404, 'Ticket not found', { source: req.headers })
      return res.status(200).json({ ok: true, ticket })
    }

    if (req.method === 'PATCH') {
      const body = (req.body ?? {}) as { status?: string; internalNotes?: string }
      const ticket = await updateSupportTicket(ticketId, body)
      if (!ticket) return sendApiError(res, 404, 'Ticket not found', { source: req.headers })
      return res.status(200).json({ ok: true, ticket })
    }

    return sendApiError(res, 405, 'Method not allowed', { source: req.headers })
  } catch (error) {
    if (isValidationError(error)) {
      return sendApiError(res, 400, error.message, { source: req.headers })
    }
    return sendApiError(res, 503, 'Support queue unavailable', {
      source: req.headers,
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
