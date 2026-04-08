import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../../_lib/cors.js'
import { sendApiError } from '../../_lib/apiError.js'
import { requireSupportOperator } from '../../_lib/supportOperator.js'
import { listSupportTickets } from '../../_lib/supportQueueStore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    return res.status(200).json({ ok: true, tickets })
  } catch (error) {
    return sendApiError(res, 503, 'Support queue unavailable', {
      source: req.headers,
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
