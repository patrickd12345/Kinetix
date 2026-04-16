import type { ProviderGenerateParams, ProviderGenerateResult } from './types.js'

const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_BASE = 'https://api.anthropic.com'

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) return fetchImpl
  if (typeof fetch === 'function') return fetch
  throw new Error('fetch is not available; pass fetchImpl')
}

/**
 * Anthropic Messages API — uses injected apiKey.
 */
export async function anthropicChat(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
  const fetchFn = resolveFetch(params.fetchImpl)
  const system = params.messages.filter((m) => m.role === 'system')
  const rest = params.messages.filter((m) => m.role !== 'system')
  const systemText = system.map((m) => m.content).join('\n\n')
  const res = await fetchFn(`${DEFAULT_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.options?.maxTokens ?? 1024,
      temperature: params.options?.temperature ?? 0.7,
      ...(systemText ? { system: systemText } : {}),
      messages: rest.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    }),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } }).error?.message ??
      (raw as { message?: string }).message ??
      `Anthropic error ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status })
  }
  const blocks = (raw as { content?: Array<{ text?: string }> }).content
  const text = Array.isArray(blocks) ? blocks.map((b) => b.text ?? '').join('') : ''
  return { text, raw }
}
