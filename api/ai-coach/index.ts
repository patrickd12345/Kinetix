import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from '../_lib/cors'
import { handleAiCoachRequest } from '../_lib/ai/requestHandlers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'x-openai-key'],
  })

  if (!cors.allowed) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleAiCoachRequest(req.body || {}, req.headers || {})
    if ('error' in result) {
      return res.status(result.status ?? 400).json({ error: result.error })
    }
    return res.status(200).json(result)
  } catch (error) {
    console.error('[api/ai-coach] AI execution failed:', error)
    const status = (error as any)?.status || 500
    return res.status(status).json({ error: 'Failed to complete AI request.' })
  }
}
