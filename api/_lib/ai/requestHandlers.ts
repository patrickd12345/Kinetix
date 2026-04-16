import type { CoachGuardrailPayload } from '@kinetix/core'
import { getLLMClient } from './llmClient.js'
import { sanitizeCoachAssistantText } from './sanitizeCoachText.js'
import { buildKinetixApiError, getApiRequestId, type KinetixApiError } from './error-contract.js'
import { getByokDecision, mustReject, readByokHeader } from '../byok.js'
import { resolveKinetixRuntimeEnv } from '../env/runtime.js'
import { getSupabaseUserFromJwt } from '../supabaseUserFromJwt.js'
import { buildVerifiedMathSystemAppendix, runMathGate } from './chatMathGate.js'
import {
  applyCoachResponseGuardrails,
  buildCoachGuardrailSystemAppendix,
  isCoachGuardrailPayload,
  renderCoachFailClosedMathResponse,
} from './coachResponseGuardrails.js'

export interface AiChatBody {
  systemInstruction?: string
  contents?: unknown[]
  /** Age + weight for deterministic KPS; optional but required for KPS math replies. */
  userProfile?: { age: number; weightKg: number }
  unitSystem?: 'metric' | 'imperial'
  guardrails?: CoachGuardrailPayload
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

function flattenUserContents(contents: unknown[]): string {
  return contents
    .map((content: any) =>
      Array.isArray(content?.parts)
        ? content.parts.map((part: any) => part?.text || '').join('\n').trim()
        : '',
    )
    .filter(Boolean)
    .join('\n\n')
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

  const { systemInstruction, contents, userProfile, unitSystem } = body
  if (!systemInstruction || !contents) {
    return buildKinetixApiError('invalid_request', 'systemInstruction and contents are required.', 400, requestId)
  }

  const userContent = Array.isArray(contents) ? flattenUserContents(contents) : ''
  const userId = await getOptionalUserIdFromHeaders(headers)
  const client = getLLMClient(process.env, { userId })
  const coachGuardrails = isCoachGuardrailPayload(body.guardrails) ? body.guardrails : null

  const profile =
    userProfile &&
    typeof userProfile === 'object' &&
    typeof (userProfile as { age?: unknown }).age === 'number' &&
    typeof (userProfile as { weightKg?: unknown }).weightKg === 'number'
      ? { age: (userProfile as { age: number }).age, weightKg: (userProfile as { weightKg: number }).weightKg }
      : null

  const unit =
    unitSystem === 'imperial' ? 'imperial' : unitSystem === 'metric' ? 'metric' : undefined

  const gate = runMathGate(userContent || 'Respond concisely.', {
    userProfile: profile,
    unitSystem: unit,
  })

  if (gate.kind === 'fail_closed') {
    const text = coachGuardrails
      ? renderCoachFailClosedMathResponse(gate.result, gate.reply)
      : gate.reply

    return {
      text: sanitizeCoachAssistantText(text),
      provider: client.provider,
      model: client.model,
      mode: 'gateway',
      latencyMs: 0,
      fallbackReason: 'verified_math_fail_closed',
    }
  }

  // Trust boundary:
  // - verified math and the coach guardrail contract are trusted deterministic inputs
  // - raw model output is untrusted until it survives the coach response guardrail pass
  let systemForLlm = systemInstruction
  if (coachGuardrails) {
    systemForLlm = `${systemForLlm}\n\n${buildCoachGuardrailSystemAppendix(coachGuardrails)}`
  }
  if (gate.kind === 'verified') {
    systemForLlm = `${systemForLlm}\n\n${buildVerifiedMathSystemAppendix(gate.promptBlock)}`
  }

  const result = await client.executeChat(
    [
      { role: 'system', content: systemForLlm },
      { role: 'user', content: userContent || 'Respond concisely.' },
    ],
    {
      temperature: gate.kind === 'verified' ? 0.35 : coachGuardrails ? 0.45 : 0.7,
      maxTokens: 1024,
    }
  )

  if (!coachGuardrails) {
    return {
      ...result,
      text: sanitizeCoachAssistantText(result.text ?? ''),
    }
  }

  const guarded = applyCoachResponseGuardrails({
    draftText: result.text ?? '',
    userContent,
    unitSystem: unit,
    guardrails: coachGuardrails,
    verifiedMathResult: gate.kind === 'verified' ? gate.result : null,
  })

  return {
    ...result,
    fallbackReason: guarded.fallbackReason ?? result.fallbackReason,
    text: sanitizeCoachAssistantText(guarded.text),
  }
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
  const client = getLLMClient(process.env, { userId })
  const result = await client.executeChat(
    [
      {
        role: 'system',
        content:
          'You are a concise running coach. Return only strict JSON matching {"title": string, "insight": string}. Do not include markdown, code fences, or fields outside that schema.',
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.35, maxTokens: 400 }
  )

  return { ...result, text: sanitizeCoachAssistantText(result.text?.trim() || '') }
}
