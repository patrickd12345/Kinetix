import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAiChatRequest } from '../_lib/ai/requestHandlers'

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-openai-key')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleAiChatRequest(req.body || {}, req.headers || {})
    if ('error' in result) {
      return res.status(result.status ?? 400).json({ error: result.error })
    }
    return res.status(200).json(result)
  } catch (error) {
    console.error('[api/ai-chat] AI execution failed:', error)
    const status = (error as any)?.status || 500
    return res.status(status).json({ error: 'Failed to complete AI request.' })
  }
}
