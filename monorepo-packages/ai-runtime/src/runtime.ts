import { recordAiCoreTelemetry, resolveKey, splitGatewayKeys } from '@bookiji-inc/ai-core'
import { resolveAiRuntimeEnv } from './env'
import { executeGatewayChat, executeGatewayEmbedding } from './providers/gateway'
import { executeOllamaChat, executeOllamaEmbedding } from './providers/ollama'
import type {
  CanonicalAiMode,
  CanonicalAiProvider,
  ExecuteChatRequest,
  ExecuteChatResult,
  ExecuteEmbeddingRequest,
  ExecuteEmbeddingResult,
  ProviderError,
} from './types'

type AttemptFailure = {
  provider: CanonicalAiProvider
  message: string
  status?: number
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return fetchImpl
  }
  if (typeof fetch === 'function') {
    return fetch
  }
  throw new Error('Global fetch is unavailable. Provide fetchImpl to executeChat/executeEmbedding.')
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof Error) {
    return error as ProviderError
  }
  return new Error(typeof error === 'string' ? error : 'AI request failed') as ProviderError
}

function summarizeFailure(error: unknown): { message: string; status?: number } {
  const normalized = toProviderError(error)
  return {
    message: normalized.message || 'AI request failed',
    status: normalized.status,
  }
}

function getExecutionOrder(mode: CanonicalAiMode, provider: CanonicalAiProvider): CanonicalAiProvider[] {
  if (mode !== 'fallback') {
    return [provider]
  }
  return provider === 'ollama' ? ['ollama', 'gateway'] : ['gateway', 'ollama']
}

function getChatModel(provider: CanonicalAiProvider, modelOverride: string | undefined, env: ReturnType<typeof resolveAiRuntimeEnv>): string {
  if (modelOverride?.trim()) {
    return modelOverride.trim()
  }
  return provider === 'ollama' ? env.ollamaModel : env.openAiModel
}

function getEmbeddingModel(
  provider: CanonicalAiProvider,
  modelOverride: string | undefined,
  env: ReturnType<typeof resolveAiRuntimeEnv>,
): string {
  if (modelOverride?.trim()) {
    return modelOverride.trim()
  }
  return provider === 'ollama' ? env.ollamaModel : env.openAiEmbeddingModel
}

function buildFailureError(action: 'chat' | 'embedding', failures: AttemptFailure[]): ProviderError {
  const summary = failures.map((failure) => `${failure.provider}: ${failure.message}`).join(' | ')
  const error = new Error(`AI ${action} request failed. ${summary}`) as ProviderError
  error.status = failures[failures.length - 1]?.status ?? 502
  return error
}

async function resolveGatewayAuth(
  request: Pick<ExecuteChatRequest | ExecuteEmbeddingRequest, 'userId' | 'product' | 'byokKey' | 'env'>,
  env: ReturnType<typeof resolveAiRuntimeEnv>,
): Promise<{ apiKey: string; byokKey: string | null; keySource: 'user' | 'platform' }> {
  const userId = request.userId?.trim() || 'anonymous'
  const product = request.product?.trim() || 'kinetix'
  const rk = await resolveKey({
    userId,
    provider: 'gateway',
    product,
    env: request.env,
  })
  const { bearerKey, byokKey } = splitGatewayKeys(rk, env.gatewayApiKey)
  const headerByok = request.byokKey?.trim() || null
  return {
    apiKey: bearerKey,
    byokKey: headerByok ?? byokKey,
    keySource: rk.source,
  }
}

export async function executeChat(request: ExecuteChatRequest): Promise<ExecuteChatResult> {
  const startedAt = Date.now()
  const env = resolveAiRuntimeEnv(request.env, {
    modeOverride: request.modeOverride,
    providerOverride: request.providerOverride,
  })
  const fetchImpl = resolveFetch(request.fetchImpl)
  const executionOrder = getExecutionOrder(env.mode, env.provider)

  const failures: AttemptFailure[] = []
  let fallbackReason: string | null = null

  for (const provider of executionOrder) {
    const model = getChatModel(provider, request.model, env)
    let gatewayKeySource: 'user' | 'platform' | undefined
    try {
      const result =
        provider === 'ollama'
          ? await executeOllamaChat({
              baseUrl: env.ollamaBaseUrl,
              model,
              messages: request.messages,
              temperature: request.temperature,
              maxTokens: request.maxTokens,
              format: request.format,
              fetchImpl,
            })
          : await (async () => {
              const gw = await resolveGatewayAuth(request, env)
              gatewayKeySource = gw.keySource
              return executeGatewayChat({
                baseUrl: env.gatewayBaseUrl,
                apiKey: gw.apiKey,
                model,
                messages: request.messages,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                byokKey: gw.byokKey,
                fetchImpl,
              })
            })()

      if (provider === 'gateway') {
        recordAiCoreTelemetry({
          keySource: gatewayKeySource ?? 'platform',
          provider: 'gateway',
          model,
          fallbackUsed: fallbackReason !== null,
          outcome: 'success',
        })
      }

      return {
        text: result.text,
        raw: result.raw,
        provider,
        model,
        mode: env.mode,
        latencyMs: Date.now() - startedAt,
        fallbackReason,
      }
    } catch (error) {
      const failure = summarizeFailure(error)
      if (provider === 'gateway') {
        recordAiCoreTelemetry({
          keySource: gatewayKeySource ?? 'platform',
          provider: 'gateway',
          model,
          fallbackUsed: fallbackReason !== null,
          outcome: 'failure',
          errorMessage: failure.message,
        })
      }
      failures.push({ provider, ...failure })
      if (env.mode === 'fallback' && fallbackReason === null) {
        fallbackReason = failure.message
      }
    }
  }

  throw buildFailureError('chat', failures)
}

export async function executeEmbedding(request: ExecuteEmbeddingRequest): Promise<ExecuteEmbeddingResult> {
  const startedAt = Date.now()
  const env = resolveAiRuntimeEnv(request.env, {
    modeOverride: request.modeOverride,
    providerOverride: request.providerOverride,
  })
  const fetchImpl = resolveFetch(request.fetchImpl)
  const executionOrder = getExecutionOrder(env.mode, env.provider)

  const failures: AttemptFailure[] = []
  let fallbackReason: string | null = null

  for (const provider of executionOrder) {
    const model = getEmbeddingModel(provider, request.model, env)
    let gatewayKeySource: 'user' | 'platform' | undefined
    try {
      const result =
        provider === 'ollama'
          ? await executeOllamaEmbedding({
              baseUrl: env.ollamaBaseUrl,
              model,
              input: request.input,
              fetchImpl,
            })
          : await (async () => {
              const gw = await resolveGatewayAuth(request, env)
              gatewayKeySource = gw.keySource
              return executeGatewayEmbedding({
                baseUrl: env.gatewayBaseUrl,
                apiKey: gw.apiKey,
                model,
                input: request.input,
                byokKey: gw.byokKey,
                fetchImpl,
              })
            })()

      if (provider === 'gateway') {
        recordAiCoreTelemetry({
          keySource: gatewayKeySource ?? 'platform',
          provider: 'gateway',
          model,
          fallbackUsed: fallbackReason !== null,
          outcome: 'success',
        })
      }

      return {
        embedding: result.embedding,
        raw: result.raw,
        provider,
        model,
        mode: env.mode,
        latencyMs: Date.now() - startedAt,
        fallbackReason,
      }
    } catch (error) {
      const failure = summarizeFailure(error)
      if (provider === 'gateway') {
        recordAiCoreTelemetry({
          keySource: gatewayKeySource ?? 'platform',
          provider: 'gateway',
          model,
          fallbackUsed: fallbackReason !== null,
          outcome: 'failure',
          errorMessage: failure.message,
        })
      }
      failures.push({ provider, ...failure })
      if (env.mode === 'fallback' && fallbackReason === null) {
        fallbackReason = failure.message
      }
    }
  }

  throw buildFailureError('embedding', failures)
}
