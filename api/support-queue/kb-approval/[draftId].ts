import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../../_lib/cors.js'
import { sendApiError } from '../../_lib/apiError.js'
import { requireSupportOperator } from '../../_lib/supportOperator.js'
import { getKbApprovalDraft, updateKbApprovalDraft } from '../../_lib/supportQueueStore.js'

function isValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith('Draft ')
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

  const draftId = typeof req.query.draftId === 'string' ? req.query.draftId : ''
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
    if (isValidationError(error)) {
      return sendApiError(res, 400, error.message, { source: req.headers })
    }
    return sendApiError(res, 503, 'KB approval queue unavailable', {
      source: req.headers,
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
