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
  const decision = getByokDecision('ai-chat', byokKey)
  if (mustReject(decision)) {
    return res.status(400).json({ error: 'BYOK is not supported on this endpoint.' })
  }

  const { systemInstruction, contents } = req.body || {}
  if (!systemInstruction || !contents) {
    return res.status(400).json({ error: 'systemInstruction and contents are required.' })
  }

  const userContent = Array.isArray(contents)
    ? contents
        .map((c: any) =>
          Array.isArray(c?.parts)
            ? c.parts.map((p: any) => p?.text || '').join('\n').trim()
            : ''
        )
        .filter(Boolean)
        .join('\n\n')
    : ''

  try {
    const client = getLLMClient()
    const { text } = await client.executeChat(
      [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent || 'Respond concisely.' },
      ],
      { temperature: 0.7, maxTokens: 1024 }
    )
    return res.status(200).json({ text })
  } catch (error) {
    console.error('[api/ai-chat] AI execution failed:', error)
    const status = (error as any)?.status || 500
    return res.status(status).json({ error: 'Failed to complete AI request.' })
  }
}
