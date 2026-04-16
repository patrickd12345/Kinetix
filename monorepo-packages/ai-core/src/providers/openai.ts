import type { ProviderGenerateParams, ProviderGenerateResult } from './types.js'

const DEFAULT_BASE = 'https://api.openai.com'

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) return fetchImpl
  if (typeof fetch === 'function') return fetch
  throw new Error('fetch is not available; pass fetchImpl')
}

/**
 * OpenAI Chat Completions — uses injected apiKey (no process.env).
 */
export async function openaiChat(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
  const fetchFn = resolveFetch(params.fetchImpl)
  const base = DEFAULT_BASE.replace(/\/$/, '')
  const res = await fetchFn(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.options?.temperature ?? 0.7,
      max_tokens: params.options?.maxTokens ?? 1024,
      stream: false,
    }),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } }).error?.message ??
      (raw as { message?: string }).message ??
      `OpenAI error ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status })
  }
  const text =
    (raw as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? ''
  return { text, raw }
}
