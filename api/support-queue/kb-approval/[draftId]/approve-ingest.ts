import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../../../_lib/cors.js'
import { sendApiError } from '../../../_lib/apiError.js'
import { requireSupportOperator } from '../../../_lib/supportOperator.js'
import { approveAndIngestKbDraft } from '../../../_lib/supportQueueStore.js'

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

  const draftId = typeof req.query.draftId === 'string' ? req.query.draftId : ''
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
