export type CanonicalAiMode = 'gateway' | 'ollama' | 'fallback'
export type CanonicalAiProvider = 'gateway' | 'ollama'
export type CanonicalAiModeInput = CanonicalAiMode | 'local'

export type RuntimeEnv = Record<string, string | undefined> & {
  VERCEL?: string
  VERCEL_ENV?: string
  VERCEL_REGION?: string
  AI_MODE?: string
  AI_PROVIDER?: string
  VERCEL_AI_BASE_URL?: string
  VERCEL_VIRTUAL_KEY?: string
  OPENAI_MODEL?: string
  OPENAI_EMBEDDING_MODEL?: string
  OLLAMA_BASE_URL?: string
  OLLAMA_MODEL?: string
  AI_GATEWAY_BASE_URL?: string
  AI_GATEWAY_API_KEY?: string
  AI_GATEWAY_MODEL?: string
  OPENAI_API_KEY?: string
  OLLAMA_API_URL?: string
  OLLAMA_URL?: string
  LLM_MODEL?: string
  KINETIX_LLM_PROVIDER?: string
}

export type CanonicalAiMetadata = {
  provider: string
  model: string
  mode: CanonicalAiMode
  latencyMs: number
  fallbackReason: string | null
}

export type CanonicalChatMessage = {
  role: 'system' | 'user' | 'assistant' | string
  content: string
}

export type ExecuteChatRequest = {
  messages: CanonicalChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  format?: 'json'
  modeOverride?: CanonicalAiModeInput
  providerOverride?: CanonicalAiProvider
  byokKey?: string | null
  /** When set, BYOK vs platform keys are resolved via @bookiji-inc/ai-core (gateway path). */
  userId?: string
  /** Product id for key scope (default kinetix). */
  product?: string
  env?: RuntimeEnv
  fetchImpl?: typeof fetch
}

export type ExecuteEmbeddingRequest = {
  input: string
  model?: string
  modeOverride?: CanonicalAiModeInput
  providerOverride?: CanonicalAiProvider
  byokKey?: string | null
  userId?: string
  product?: string
  env?: RuntimeEnv
  fetchImpl?: typeof fetch
}

export type ExecuteChatResult = CanonicalAiMetadata & {
  text: string
  raw: unknown
}

export type ExecuteEmbeddingResult = CanonicalAiMetadata & {
  embedding: number[]
  raw: unknown
}

export type ProviderChatResult = {
  text: string
  raw: unknown
}

export type ProviderEmbeddingResult = {
  embedding: number[]
  raw: unknown
}

export type ProviderError = Error & { status?: number }
