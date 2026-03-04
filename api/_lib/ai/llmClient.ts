/**
 * getLLMClient() - Kinetix local LLM abstraction (web).
 *
 * CONTRACT (must match apps/rag/services/ai/llmClient.js when duplicated):
 * - resolveProvider(env): 'ollama' | 'gateway'
 *   Canonical: KINETIX_LLM_PROVIDER=ollama|gateway.
 *   If unset: VERCEL=1 -> gateway, else -> ollama. Do not use NODE_ENV.
 * - resolveModel(env, provider): string
 * - getLLMClient(env?): { provider, model, executeChat }
 * - executeChat(messages, options?): Promise<{ text: string }>
 * - Gateway: OpenAI-compatible (baseURL + apiKey). Env: AI_GATEWAY_BASE_URL, AI_GATEWAY_API_KEY, AI_GATEWAY_MODEL.
 * - Ollama: OLLAMA_BASE_URL (fallback OLLAMA_API_URL), OLLAMA_MODEL / LLM_MODEL.
 */

export type LLMProvider = 'ollama' | 'gateway'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ExecuteChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface LLMClient {
  provider: LLMProvider
  model: string
  executeChat: (
    messages: ChatMessage[],
    options?: ExecuteChatOptions
  ) => Promise<{ text: string }>
}

function getEnv(): NodeJS.ProcessEnv {
  return typeof process !== 'undefined' ? process.env : {}
}

/**
 * Canonical provider switch. Single source of truth.
 * KINETIX_LLM_PROVIDER=ollama|gateway. If unset: VERCEL=1 -> gateway, else ollama.
 */
export function resolveProvider(env: NodeJS.ProcessEnv = getEnv()): LLMProvider {
  const provider = (env.KINETIX_LLM_PROVIDER || '').toLowerCase()
  if (provider === 'ollama' || provider === 'gateway') {
    return provider
  }
  if (env.VERCEL === '1') {
    return 'gateway'
  }
  return 'ollama'
}

export function resolveModel(env: NodeJS.ProcessEnv, provider: LLMProvider): string {
  if (provider === 'gateway') {
    return env.AI_GATEWAY_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini'
  }
  return env.OLLAMA_MODEL || env.LLM_MODEL || 'llama3.2'
}

async function executeOllamaGenerate(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  options: ExecuteChatOptions
): Promise<{ text: string }> {
  const prompt = messages
    .map((m) => `${m.role === 'system' ? 'System: ' : ''}${m.content}`)
    .join('\n\n')
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: 0.9,
      },
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    const err = new Error(`Ollama API error: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const data = (await res.json()) as { response?: string }
  let text = (data.response || '').trim()
  const systemPrefix = messages.find((m) => m.role === 'system')?.content?.slice(0, 80) ?? ''
  if (systemPrefix && text.startsWith(systemPrefix.slice(0, 60))) {
    text = text.slice(text.indexOf('\n\n') + 2).trim()
  }
  return { text }
}

async function executeOllama(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  options: ExecuteChatOptions
): Promise<{ text: string }> {
  const ollamaMessages = messages.map((m) => ({
    role: m.role === 'system' ? ('system' as const) : m.role === 'model' ? ('assistant' as const) : ('user' as const),
    content: m.content,
  }))
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: 0.9,
      },
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (res.ok) {
    const data = (await res.json()) as { message?: { role?: string; content?: string } }
    const text = data.message?.content?.trim() ?? ''
    return { text }
  }
  if (res.status === 500) {
    try {
      return await executeOllamaGenerate(baseUrl, model, messages, options)
    } catch (fallbackErr) {
      const err = new Error(`Ollama API error: 500 (chat failed; generate fallback also failed)`) as Error & { status?: number }
      err.status = 500
      throw err
    }
  }
  const err = new Error(`Ollama API error: ${res.status}`) as Error & { status?: number }
  err.status = res.status
  throw err
}

async function executeGateway(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: ExecuteChatOptions
): Promise<{ text: string }> {
  const url = baseUrl.replace(/\/$/, '') + '/v1/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    const err = new Error(`Gateway API error: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text =
    data.choices?.[0]?.message?.content?.trim() ?? ''
  return { text }
}

/**
 * Returns LLM client with deterministic provider routing.
 * Logs provider and model for smoke verification.
 */
export function getLLMClient(env: NodeJS.ProcessEnv = getEnv()): LLMClient {
  const provider = resolveProvider(env)
  const model = resolveModel(env, provider)

  const executeChat: LLMClient['executeChat'] = async (messages, options = {}) => {
    const effectiveModel = options.model ?? model
    console.info('[LLM]', { provider, model: effectiveModel })

    if (provider === 'ollama') {
      const baseUrl =
        env.OLLAMA_BASE_URL || env.OLLAMA_API_URL || 'http://localhost:11434'
      return executeOllama(baseUrl, effectiveModel, messages, options)
    }

    const baseUrl = env.AI_GATEWAY_BASE_URL
    const apiKey = env.AI_GATEWAY_API_KEY || env.OPENAI_API_KEY
    if (!baseUrl || !apiKey) {
      throw new Error(
        'Gateway mode requires AI_GATEWAY_BASE_URL and AI_GATEWAY_API_KEY (or OPENAI_API_KEY)'
      )
    }
    return executeGateway(baseUrl, apiKey, effectiveModel, messages, options)
  }

  return { provider, model, executeChat }
}
