import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../../../_lib/cors.js'
import { sendApiError } from '../../../_lib/apiError.js'
import { requireSupportOperator } from '../../../_lib/supportOperator.js'
import { moveTicketToKbApprovalBin } from '../../../_lib/supportQueueStore.js'

function isValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message === 'Only resolved tickets can move to the KB approval bin'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
  })
  if (!cors.allowed) return sendApiError(res, 403, 'Origin not allowed', { source: req.headers })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return sendApiError(res, 405, 'Method not allowed', { source: req.headers })

  const operator = await requireSupportOperator(req)
  if (!operator) return sendApiError(res, 403, 'Support operator access required', { source: req.headers })

  const ticketId = typeof req.query.ticketId === 'string' ? req.query.ticketId : ''
  if (!ticketId) return sendApiError(res, 400, 'ticketId is required', { source: req.headers })

  try {
    const draft = await moveTicketToKbApprovalBin(ticketId, operator.id)
    if (!draft) return sendApiError(res, 404, 'Ticket not found', { source: req.headers })
    return res.status(200).json({ ok: true, draft })
  } catch (error) {
    if (isValidationError(error)) {
      return sendApiError(res, 400, error.message, { source: req.headers })
    }
    return sendApiError(res, 503, 'KB approval bin unavailable', {
      source: req.headers,
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
