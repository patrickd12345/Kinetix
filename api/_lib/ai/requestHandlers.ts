import { getLLMClient } from './llmClient.js'
import { buildKinetixApiError, getApiRequestId, type KinetixApiError } from './error-contract.js'
import { getByokDecision, mustReject, readByokHeader } from '../byok.js'
import { resolveKinetixRuntimeEnv } from '../env/runtime.js'
import { getSupabaseUserFromJwt } from '../supabaseUserFromJwt.js'

export interface AiChatBody {
  systemInstruction?: string
  contents?: unknown[]
}

export interface AiCoachBody {
  prompt?: string
}

export type AiHandlerError = KinetixApiError

export interface AiHandlerSuccess {
  text: string
  provider: string
  model: string
  mode: string
  latencyMs: number
  fallbackReason: string | null
}

type HeaderMap = Record<string, string | string[] | undefined>

function hasAuthorizationHeader(headers: HeaderMap): boolean {
  const value = headers.authorization ?? headers.Authorization
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some((v) => String(v).trim().length > 0)
  return false
}

function isApiAuthRequired(): boolean {
  return resolveKinetixRuntimeEnv().apiRequireAuth
}

async function getOptionalUserIdFromHeaders(headers: HeaderMap): Promise<string | undefined> {
  const auth = headers.authorization ?? headers.Authorization
  const token =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token) {
    return undefined
  }
  const env = resolveKinetixRuntimeEnv()
  const url = env.supabaseUrl
  const anon = env.supabaseAnonKey
  if (!url || !anon) {
    return undefined
  }
  const user = await getSupabaseUserFromJwt(url, anon, token)
  return user?.id
}

export async function handleAiChatRequest(
  body: AiChatBody,
  headers: HeaderMap
): Promise<AiHandlerSuccess | AiHandlerError> {
  const requestId = getApiRequestId(headers)
  if (isApiAuthRequired() && !hasAuthorizationHeader(headers)) {
    return buildKinetixApiError('unauthorized', 'Authorization header is required.', 401, requestId)
  }

  const byokKey = readByokHeader(headers)
  const decision = getByokDecision('ai-chat', byokKey)
  if (mustReject(decision)) {
    return buildKinetixApiError('byok_not_supported', 'BYOK is not supported on this endpoint.', 400, requestId)
  }

  const { systemInstruction, contents } = body
  if (!systemInstruction || !contents) {
    return buildKinetixApiError('invalid_request', 'systemInstruction and contents are required.', 400, requestId)
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

  const userId = await getOptionalUserIdFromHeaders(headers)
  const client = getLLMClient(undefined, { userId })
  const result = await client.executeChat(
    [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userContent || 'Respond concisely.' },
    ],
    { temperature: 0.7, maxTokens: 1024 }
  )

  return result
}

export async function handleAiCoachRequest(
  body: AiCoachBody,
  headers: HeaderMap
): Promise<AiHandlerSuccess | AiHandlerError> {
  const requestId = getApiRequestId(headers)
  if (isApiAuthRequired() && !hasAuthorizationHeader(headers)) {
    return buildKinetixApiError('unauthorized', 'Authorization header is required.', 401, requestId)
  }

  const byokKey = readByokHeader(headers)
  const decision = getByokDecision('ai-coach', byokKey)
  if (mustReject(decision)) {
    return buildKinetixApiError('byok_not_supported', 'BYOK is not supported on this endpoint.', 400, requestId)
  }

  const { prompt } = body
  if (!prompt || typeof prompt !== 'string') {
    return buildKinetixApiError('invalid_request', 'prompt is required.', 400, requestId)
  }

  const userId = await getOptionalUserIdFromHeaders(headers)
  const client = getLLMClient(undefined, { userId })
  const result = await client.executeChat(
    [
      { role: 'system', content: 'You are a concise running coach.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.7, maxTokens: 400 }
  )

  return { ...result, text: result.text?.trim() || '' }
}
