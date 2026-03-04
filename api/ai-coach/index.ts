import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getLLMClient } from '../_lib/ai/llmClient'
import { getByokDecision, mustReject, readByokHeader } from '../_lib/byok'

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

  const byokKey = readByokHeader(req.headers || {})
  const decision = getByokDecision('ai-coach', byokKey)
  if (mustReject(decision)) {
    return res.status(400).json({ error: 'BYOK is not supported on this endpoint.' })
  }

  const { prompt } = req.body || {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required.' })
  }

  try {
    const client = getLLMClient()
    const { text } = await client.executeChat(
      [
        { role: 'system', content: 'You are a concise running coach.' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.7, maxTokens: 400 }
    )
    return res.status(200).json({ text: text?.trim() || '' })
  } catch (error) {
    console.error('[api/ai-coach] AI execution failed:', error)
    const status = (error as any)?.status || 500
    return res.status(status).json({ error: 'Failed to complete AI request.' })
  }
}
