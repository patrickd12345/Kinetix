/**
 * Help Center support assistant — POST /api/ai-chat with KB-grounded user content.
 * Same contract as Vercel `api/ai-chat` and local `vite-plugin-oauth` middleware.
 */

import type { SupportKBQueryOutcome, SupportKBResultItem } from './supportRagClient'

export const HELP_SUPPORT_AI_SYSTEM_INSTRUCTION = `You are the in-app support assistant for Kinetix (a running analytics web app).
Answer using ONLY the support knowledge excerpts provided in the user message.
If excerpts are missing or insufficient to answer safely, say so briefly and suggest Settings, Help Center tips, or Coach chat for run-specific coaching — do not invent product facts.
Keep answers concise (under 200 words), use short bullet lists when helpful, and do not claim you filed a ticket or contacted support.`

export type HelpSupportAiSuccess = {
  ok: true
  text: string
  provider?: string
  model?: string
  mode?: string
  latencyMs?: number
  fallbackReason?: string | null
}

export type HelpSupportAiFailure = {
  ok: false
  reason: 'http_error' | 'network' | 'invalid_response'
  status?: number
  message?: string
}

export type HelpSupportAiOutcome = HelpSupportAiSuccess | HelpSupportAiFailure

function resolveAiChatUrl(): string {
  const fromEnv =
    typeof import.meta.env.VITE_HELP_CENTER_AI_URL === 'string'
      ? import.meta.env.VITE_HELP_CENTER_AI_URL.trim()
      : ''
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/ai-chat`
  }
  return '/api/ai-chat'
}

function articleTitle(r: SupportKBResultItem): string {
  const t = r.metadata.title
  if (typeof t === 'string' && t.trim()) return t.trim()
  return r.chunkId || 'Article'
}

function serializeKbContextForPrompt(
  query: string,
  outcome: SupportKBQueryOutcome,
  maxCharsPerDoc = 1200,
): string {
  const q = query.trim() || '(empty query)'
  if (outcome.ok === false) {
    return `User question:\n${q}\n\nSupport knowledge excerpts:\n(none — retrieval failed: ${outcome.reason}${outcome.reason === 'http_error' ? `, status ${outcome.status}` : ''})`
  }
  if (outcome.data.results.length === 0) {
    return `User question:\n${q}\n\nSupport knowledge excerpts:\n(none — no matching articles in the curated KB)`
  }
  const blocks = outcome.data.results.map((r, i) => {
    const title = articleTitle(r)
    const body = (r.document || '').trim()
    const clipped = body.length > maxCharsPerDoc ? `${body.slice(0, maxCharsPerDoc)}…` : body
    const sim =
      typeof r.similarity === 'number' && Number.isFinite(r.similarity)
        ? r.similarity.toFixed(4)
        : 'n/a'
    return `--- Excerpt ${i + 1} | ${title} | similarity=${sim} | chunk=${r.chunkId} ---\n${clipped}`
  })
  return `User question:\n${q}\n\nSupport knowledge excerpts:\n${blocks.join('\n\n')}`
}

function parseAiChatJson(data: unknown): HelpSupportAiOutcome {
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: 'invalid_response' }
  }
  const o = data as Record<string, unknown>
  if (typeof o.text === 'string' && o.text.trim()) {
    return {
      ok: true,
      text: o.text.trim(),
      provider: typeof o.provider === 'string' ? o.provider : undefined,
      model: typeof o.model === 'string' ? o.model : undefined,
      mode: typeof o.mode === 'string' ? o.mode : undefined,
      latencyMs: typeof o.latencyMs === 'number' ? o.latencyMs : undefined,
      fallbackReason: o.fallbackReason === null ? null : typeof o.fallbackReason === 'string' ? o.fallbackReason : null,
    }
  }
  if (typeof o.code === 'string') {
    const msg = typeof o.message === 'string' ? o.message : o.code
    return { ok: false, reason: 'http_error', message: msg }
  }
  if (typeof o.error === 'string') {
    return { ok: false, reason: 'http_error', message: o.error }
  }
  return { ok: false, reason: 'invalid_response' }
}

/**
 * Calls the configured ai-chat endpoint with KB-grounded content.
 */
export async function postHelpCenterSupportAnswer(
  query: string,
  kbOutcome: SupportKBQueryOutcome,
  options: { accessToken?: string | null } = {},
): Promise<HelpSupportAiOutcome> {
  const url = resolveAiChatUrl()
  const userPayload = serializeKbContextForPrompt(query, kbOutcome)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = options.accessToken?.trim()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const body = {
    systemInstruction: HELP_SUPPORT_AI_SYSTEM_INSTRUCTION,
    contents: [{ parts: [{ text: userPayload }] }],
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    })
    let data: unknown
    try {
      data = await res.json()
    } catch {
      data = null
    }
    if (!res.ok) {
      const parsed = parseAiChatJson(data)
      if (!parsed.ok && parsed.message) {
        return { ok: false, reason: 'http_error', status: res.status, message: parsed.message }
      }
      return {
        ok: false,
        reason: 'http_error',
        status: res.status,
        message:
          typeof (data as { message?: string })?.message === 'string'
            ? (data as { message: string }).message
            : typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : `HTTP ${res.status}`,
      }
    }
    const parsed = parseAiChatJson(data)
    if (!parsed.ok) {
      return parsed.reason === 'http_error'
        ? { ok: false, reason: 'invalid_response', message: parsed.message }
        : parsed
    }
    return parsed
  } catch {
    return { ok: false, reason: 'network', message: 'Network error' }
  }
}
