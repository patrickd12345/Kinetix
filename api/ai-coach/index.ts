import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors'
import { serializeApiError, toApiHttpError } from '../_lib/ai/error-contract'
import { getObservedRequestId, logApiEvent } from '../_lib/observability'
import { handleAiCoachRequest } from '../_lib/ai/requestHandlers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'x-openai-key'],
  })

  if (!cors.allowed) {
    return res.status(403).json({ code: 'origin_not_allowed', message: 'Origin not allowed' })
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed', message: 'Method not allowed' })
  }

  try {
    const result = await handleAiCoachRequest(req.body || {}, req.headers || {})
    if ('code' in result) {
      return res.status(result.status ?? 400).json(serializeApiError(result))
    }
    return res.status(200).json(result)
  } catch (error) {
    const requestId = getObservedRequestId(req.headers || {})
    logApiEvent('error', 'kinetix_ai_coach_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    const normalized = toApiHttpError(error, {
      fallbackCode: 'ai_execution_failed',
      fallbackMessage: 'Failed to complete AI request.',
      fallbackStatus: 500,
      requestId,
    })
    const status = normalized.status || 500
    return res.status(status).json(serializeApiError(normalized))
  }
}
