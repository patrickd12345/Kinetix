import {
  executeChat as executeSharedChat,
  executeEmbedding as executeSharedEmbedding,
} from '@bookiji-inc/ai-runtime'
import {
  commitSessionBoundary,
  emptySessionBoundaryPayload,
  startSession,
} from '@bookiji-inc/persistent-memory-runtime'
import { buildKinetixBoundaryFromChat } from './kinetixMemoryBoundary.js'
import { bridgeKinetixRuntimeToUmbrella, shouldBridgeKinetixToUmbrella } from './umbrellaRuntimeBridge.js'
import { logAiEvent } from '../observability.js'
import { resolveKinetixRuntimeEnv } from '../env/runtime.js'

/**
 * getLLMClient() - Kinetix local LLM abstraction (web).
 *
 * CONTRACT (must match apps/rag/services/ai/llmClient.js when duplicated):
 * - resolveProvider(env): 'ollama' | 'gateway'
 *   Canonical: KINETIX_LLM_PROVIDER=ollama|gateway.
 *   If unset: VERCEL=1 -> gateway, else -> ollama. Do not use NODE_ENV.
 * - resolveModel(env, provider): string
 * - getLLMClient(env?, opts?): { provider, model, executeChat }
 * - executeChat(messages, options?): Promise<{ text: string }>
 * - Gateway: OpenAI-compatible (baseURL + apiKey). Env: AI_GATEWAY_BASE_URL, AI_GATEWAY_API_KEY, AI_GATEWAY_MODEL.
 * - Ollama: OLLAMA_BASE_URL (fallback OLLAMA_API_URL), OLLAMA_MODEL / LLM_MODEL.
 */

export type LLMProvider = 'ollama' | 'gateway'
export type CanonicalMode = 'ollama' | 'gateway' | 'fallback'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ExecuteChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface ExecuteEmbeddingOptions {
  model?: string
}

export interface AIExecutionMetadata {
  provider: LLMProvider
  model: string
  mode: CanonicalMode
  latencyMs: number
  fallbackReason: string | null
}

export interface LLMClient {
  provider: LLMProvider
  model: string
  executeChat: (
    messages: ChatMessage[],
    options?: ExecuteChatOptions
  ) => Promise<{ text: string } & AIExecutionMetadata>
  executeEmbedding: (
    input: string,
    options?: ExecuteEmbeddingOptions
  ) => Promise<{ embedding: number[] } & AIExecutionMetadata>
}

function getEnv(): NodeJS.ProcessEnv {
  return (globalThis as typeof globalThis & { process?: { env?: NodeJS.ProcessEnv } }).process?.env ?? {}
}

/**
 * Canonical provider switch. Single source of truth.
 * KINETIX_LLM_PROVIDER=ollama|gateway. If unset: VERCEL=1 -> gateway, else ollama.
 */
export function resolveProvider(env: NodeJS.ProcessEnv = getEnv()): LLMProvider {
  const runtime = resolveKinetixRuntimeEnv(env)
  if (runtime.aiProvider === 'gateway' || runtime.aiProvider === 'ollama') {
    return runtime.aiProvider
  }
  if (env.VERCEL === '1' || runtime.aiMode === 'gateway') {
    return 'gateway'
  }
  return 'ollama'
}

export function resolveModel(env: NodeJS.ProcessEnv, provider: LLMProvider): string {
  const runtime = resolveKinetixRuntimeEnv(env)
  if (provider === 'gateway') {
    return runtime.openAiModel
  }
  return runtime.ollamaModel
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

function getBaseUrl(env: NodeJS.ProcessEnv, provider: LLMProvider): string | undefined {
  const runtime = resolveKinetixRuntimeEnv(env)
  if (provider === 'gateway') {
    return runtime.vercelAiBaseUrl
  }
  return runtime.ollamaBaseUrl
}

function getApiKey(env: NodeJS.ProcessEnv): string | undefined {
  return resolveKinetixRuntimeEnv(env).vercelVirtualKey
}

function resolvePersistentMemoryTenant(env: NodeJS.ProcessEnv): string {
  const fromEnv = env.KINETIX_PERSISTENT_MEMORY_TENANT?.trim()
  if (fromEnv) {
    return fromEnv
  }
  return 'default'
}

function injectMemoryContext(
  messages: ChatMessage[],
  memorySummary: string,
): ChatMessage[] {
  if (!memorySummary.trim()) {
    return messages
  }
  const prefix = `[persistent_memory_context]\n${memorySummary.trim()}\n[/persistent_memory_context]`
  const firstUser = messages.findIndex((m) => m.role === 'user')
  if (firstUser < 0) {
    return messages
  }
  const copy = [...messages]
  copy[firstUser] = { ...copy[firstUser], content: `${prefix}\n\n${copy[firstUser].content}` }
  return copy
}

function isProviderError(error: unknown): error is Error & { status?: number } {
  return error instanceof Error
}

/**
 * Returns LLM client with deterministic provider routing.
 * Logs provider and model for smoke verification.
 */
export function getLLMClient(
  env: NodeJS.ProcessEnv = getEnv(),
  opts?: { userId?: string },
): LLMClient {
  const provider = resolveProvider(env)
  const model = resolveModel(env, provider)
  const product = 'kinetix'

  const executeChat: LLMClient['executeChat'] = async (messages, options = {}) => {
    const startedAt = Date.now()
    const effectiveModel = options.model ?? model
    const memoryHandle = await startSession('kinetix', resolvePersistentMemoryTenant(env))
    const prior = memoryHandle.memory.lastCommitted ?? emptySessionBoundaryPayload()
    const memorySummary = [
      prior.sessionSummary,
      ...prior.current_focus,
      ...prior.next_actions.slice(0, 3),
    ]
      .filter(Boolean)
      .join(' | ')
    const messagesWithMemory = injectMemoryContext(messages, memorySummary)
    try {
      const result = await executeSharedChat({
        messages: messagesWithMemory,
        model: effectiveModel,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1024,
        modeOverride: provider,
        providerOverride: provider,
        userId: opts?.userId,
        product,
        env,
      })
      const response = {
        text: result.text,
        provider,
        model: effectiveModel,
        mode: result.mode as any,
        latencyMs: result.latencyMs,
        fallbackReason: result.fallbackReason,
      }
      logAiEvent('kinetix_ai_chat_completed', response, { surface: 'llmClient' })
      const boundary = buildKinetixBoundaryFromChat(messages, result.text, 'llmClient')
      try {
        await commitSessionBoundary(memoryHandle, boundary)
      } catch {
        /* ignore disk failures */
      }
      if (shouldBridgeKinetixToUmbrella(env)) {
        void bridgeKinetixRuntimeToUmbrella(env, boundary).catch(() => {
          /* explicit opt-in bridge; failures must not affect chat */
        })
      }
      return response
    } catch (error) {
      if (provider === 'ollama' && isProviderError(error) && error.status === 500) {
        const baseUrl = getBaseUrl(env, provider) ?? 'http://localhost:11434'
        const result = await executeOllamaGenerate(baseUrl, effectiveModel, messagesWithMemory, options)
        const response = {
          ...result,
          provider,
          model: effectiveModel,
          mode: 'ollama',
          latencyMs: Date.now() - startedAt,
          fallbackReason: 'ollama_chat_failed_generate_fallback',
        }
        logAiEvent('kinetix_ai_chat_completed', response, {
          surface: 'llmClient',
          fallbackPath: 'generate',
        })
        const boundaryFb = buildKinetixBoundaryFromChat(messages, result.text, 'llmClient:generate_fallback')
        try {
          await commitSessionBoundary(memoryHandle, boundaryFb)
        } catch {
          /* ignore */
        }
        if (shouldBridgeKinetixToUmbrella(env)) {
          void bridgeKinetixRuntimeToUmbrella(env, boundaryFb).catch(() => {})
        }
        return response
      }
      throw error
    }
  }

  const executeEmbedding: LLMClient['executeEmbedding'] = async (input, options = {}) => {
    const effectiveModel =
      options.model ??
      (provider === 'gateway'
        ? (resolveKinetixRuntimeEnv(env).openAiModel || 'text-embedding-3-small')
        : model)
    if (provider === 'gateway' && (!getBaseUrl(env, provider) || !getApiKey(env))) {
      throw new Error(
        'Gateway mode requires VERCEL_AI_BASE_URL/AI_GATEWAY_BASE_URL and VERCEL_VIRTUAL_KEY/AI_GATEWAY_API_KEY (or OPENAI_API_KEY)'
      )
    }

    const result = await executeSharedEmbedding({
      input,
      model: effectiveModel,
      modeOverride: provider,
      providerOverride: provider,
      userId: opts?.userId,
      product,
      env,
    })

    const response = {
      embedding: result.embedding,
      provider,
      model: effectiveModel,
      mode: result.mode,
      latencyMs: result.latencyMs,
      fallbackReason: result.fallbackReason,
    }
    logAiEvent('kinetix_ai_embedding_completed', response, { surface: 'llmClient' })
    return response
  }

  return { provider, model, executeChat, executeEmbedding }
}
