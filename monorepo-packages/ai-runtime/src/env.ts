import type { CanonicalAiMode, CanonicalAiModeInput, CanonicalAiProvider, RuntimeEnv } from './types'

type ResolveEnvOptions = {
  modeOverride?: CanonicalAiModeInput
  providerOverride?: CanonicalAiProvider
}

export type ResolvedAiRuntimeEnv = {
  mode: CanonicalAiMode
  provider: CanonicalAiProvider
  gatewayBaseUrl: string
  gatewayApiKey: string | null
  openAiModel: string
  openAiEmbeddingModel: string
  ollamaBaseUrl: string
  ollamaModel: string
}

const DEFAULT_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh'
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_GATEWAY_MODEL = 'gpt-4o-mini'
const DEFAULT_GATEWAY_EMBEDDING_MODEL = 'text-embedding-3-small'
const DEFAULT_OLLAMA_MODEL = 'llama3.2'

function getDefaultEnv(): RuntimeEnv {
  if (typeof process === 'undefined') {
    return {}
  }
  return process.env as RuntimeEnv
}

function trimOrUndefined(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized || undefined
}

function withNoTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizeMode(value: string | undefined): CanonicalAiMode | undefined {
  const normalized = value?.toLowerCase()
  if (normalized === 'local' || normalized === 'ollama') {
    return 'ollama'
  }
  if (normalized === 'gateway') {
    return 'gateway'
  }
  if (normalized === 'fallback') {
    return 'fallback'
  }
  return undefined
}

function normalizeProvider(value: string | undefined): CanonicalAiProvider | undefined {
  const normalized = value?.toLowerCase()
  if (normalized === 'gateway' || normalized === 'ollama') {
    return normalized
  }
  return undefined
}

/** True on Vercel serverless/edge — never use localhost Ollama here. */
function isVercelRuntime(env: RuntimeEnv): boolean {
  if (env.VERCEL === '1') {
    return true
  }
  if (
    env.VERCEL_ENV === 'production' ||
    env.VERCEL_ENV === 'preview' ||
    env.VERCEL_ENV === 'development'
  ) {
    return true
  }
  if (typeof env.VERCEL_REGION === 'string' && env.VERCEL_REGION.trim().length > 0) {
    return true
  }
  return false
}

export function resolveCanonicalMode(env: RuntimeEnv = getDefaultEnv(), modeOverride?: CanonicalAiModeInput): CanonicalAiMode {
  const override = normalizeMode(modeOverride)
  if (override) {
    if (isVercelRuntime(env) && override === 'ollama') {
      return 'gateway'
    }
    return override
  }

  const fromMode = normalizeMode(trimOrUndefined(env.AI_MODE))
  if (fromMode) {
    if (isVercelRuntime(env) && fromMode === 'ollama') {
      return 'gateway'
    }
    return fromMode
  }

  const fromProvider = normalizeProvider(trimOrUndefined(env.AI_PROVIDER) ?? trimOrUndefined(env.KINETIX_LLM_PROVIDER))
  if (fromProvider) {
    if (isVercelRuntime(env) && fromProvider === 'ollama') {
      return 'gateway'
    }
    return fromProvider
  }

  return 'gateway'
}

export function resolveCanonicalProvider(
  env: RuntimeEnv = getDefaultEnv(),
  mode: CanonicalAiMode,
  providerOverride?: CanonicalAiProvider,
): CanonicalAiProvider {
  const override = normalizeProvider(providerOverride)
  if (override) {
    if (isVercelRuntime(env) && override === 'ollama') {
      return 'gateway'
    }
    return override
  }

  if (mode === 'gateway') {
    return 'gateway'
  }

  const fromEnv = normalizeProvider(trimOrUndefined(env.AI_PROVIDER) ?? trimOrUndefined(env.KINETIX_LLM_PROVIDER))
  if (fromEnv) {
    if (isVercelRuntime(env) && fromEnv === 'ollama') {
      return 'gateway'
    }
    return fromEnv
  }

  if (mode === 'ollama') {
    return 'ollama'
  }

  return 'gateway'
}

export function resolveAiRuntimeEnv(env: RuntimeEnv = getDefaultEnv(), options: ResolveEnvOptions = {}): ResolvedAiRuntimeEnv {
  const mode = resolveCanonicalMode(env, options.modeOverride)
  const provider = resolveCanonicalProvider(env, mode, options.providerOverride)

  const gatewayBaseUrl = withNoTrailingSlash(
    trimOrUndefined(env.VERCEL_AI_BASE_URL) ??
      trimOrUndefined(env.AI_GATEWAY_BASE_URL) ??
      DEFAULT_GATEWAY_BASE_URL,
  )

  const gatewayApiKey =
    trimOrUndefined(env.VERCEL_VIRTUAL_KEY) ??
    trimOrUndefined(env.AI_GATEWAY_API_KEY) ??
    trimOrUndefined(env.OPENAI_API_KEY) ??
    null

  const openAiModel =
    trimOrUndefined(env.OPENAI_MODEL) ??
    trimOrUndefined(env.AI_GATEWAY_MODEL) ??
    DEFAULT_GATEWAY_MODEL

  const openAiEmbeddingModel =
    trimOrUndefined(env.OPENAI_EMBEDDING_MODEL) ??
    trimOrUndefined(env.OPENAI_MODEL) ??
    trimOrUndefined(env.AI_GATEWAY_MODEL) ??
    DEFAULT_GATEWAY_EMBEDDING_MODEL

  const ollamaBaseUrl = withNoTrailingSlash(
    trimOrUndefined(env.OLLAMA_BASE_URL) ??
      trimOrUndefined(env.OLLAMA_API_URL) ??
      trimOrUndefined(env.OLLAMA_URL) ??
      DEFAULT_OLLAMA_BASE_URL,
  )

  const ollamaModel =
    trimOrUndefined(env.OLLAMA_MODEL) ??
    trimOrUndefined(env.LLM_MODEL) ??
    DEFAULT_OLLAMA_MODEL

  return {
    mode,
    provider,
    gatewayBaseUrl,
    gatewayApiKey,
    openAiModel,
    openAiEmbeddingModel,
    ollamaBaseUrl,
    ollamaModel,
  }
}
