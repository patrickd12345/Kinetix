import type { ProviderGenerateParams, ProviderGenerateResult } from './types.js'

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) return fetchImpl
  if (typeof fetch === 'function') return fetch
  throw new Error('fetch is not available; pass fetchImpl')
}

/**
 * Google Generative Language API (Gemini) — uses injected apiKey as query param.
 */
export async function geminiChat(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
  const fetchFn = resolveFetch(params.fetchImpl)
  const model = params.model.includes('/') ? params.model : `models/${params.model}`
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`,
  )
  url.searchParams.set('key', params.apiKey)

  const parts = params.messages.flatMap((m) => [{ text: `${m.role}: ${m.content}` }])
  const res = await fetchFn(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: params.options?.temperature ?? 0.7,
        maxOutputTokens: params.options?.maxTokens ?? 1024,
      },
    }),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } }).error?.message ??
      (raw as { message?: string }).message ??
      `Gemini error ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status })
  }
  const candidates = (raw as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates
  const text =
    candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return { text, raw }
}
