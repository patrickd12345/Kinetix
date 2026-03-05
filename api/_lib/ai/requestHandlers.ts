import { getLLMClient } from './llmClient'
import { getByokDecision, mustReject, readByokHeader } from '../byok'

export interface AiChatBody {
  systemInstruction?: string
  contents?: unknown[]
}

export interface AiCoachBody {
  prompt?: string
}

export interface AiHandlerError {
  error: string
  status?: number
}

export interface AiHandlerSuccess {
  text: string
}

type HeaderMap = Record<string, string | string[] | undefined>

function hasAuthorizationHeader(headers: HeaderMap): boolean {
  const value = headers.authorization ?? headers.Authorization
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some((v) => String(v).trim().length > 0)
  return false
}

function isApiAuthRequired(): boolean {
  const raw = process.env.KINETIX_API_REQUIRE_AUTH
  return raw === '1' || raw === 'true'
}

export async function handleAiChatRequest(
  body: AiChatBody,
  headers: HeaderMap
): Promise<AiHandlerSuccess | AiHandlerError> {
  if (isApiAuthRequired() && !hasAuthorizationHeader(headers)) {
    return { error: 'Authorization header is required.', status: 401 }
  }

  const byokKey = readByokHeader(headers)
  const decision = getByokDecision('ai-chat', byokKey)
  if (mustReject(decision)) {
    return { error: 'BYOK is not supported on this endpoint.', status: 400 }
  }

  const { systemInstruction, contents } = body
  if (!systemInstruction || !contents) {
    return { error: 'systemInstruction and contents are required.', status: 400 }
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

  const client = getLLMClient()
  const { text } = await client.executeChat(
    [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userContent || 'Respond concisely.' },
    ],
    { temperature: 0.7, maxTokens: 1024 }
  )

  return { text }
}

export async function handleAiCoachRequest(
  body: AiCoachBody,
  headers: HeaderMap
): Promise<AiHandlerSuccess | AiHandlerError> {
  if (isApiAuthRequired() && !hasAuthorizationHeader(headers)) {
    return { error: 'Authorization header is required.', status: 401 }
  }

  const byokKey = readByokHeader(headers)
  const decision = getByokDecision('ai-coach', byokKey)
  if (mustReject(decision)) {
    return { error: 'BYOK is not supported on this endpoint.', status: 400 }
  }

  const { prompt } = body
  if (!prompt || typeof prompt !== 'string') {
    return { error: 'prompt is required.', status: 400 }
  }

  const client = getLLMClient()
  const { text } = await client.executeChat(
    [
      { role: 'system', content: 'You are a concise running coach.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.7, maxTokens: 400 }
  )

  return { text: text?.trim() || '' }
}
