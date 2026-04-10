type Msg = { role: string; content: string }

type SharedChatParams = {
  messages: Msg[]
  model?: string
  temperature?: number
  maxTokens?: number
  modeOverride?: string
  providerOverride?: string
  userId?: string
  product?: string
  env?: NodeJS.ProcessEnv
}

type SharedEmbeddingParams = {
  input: string
  model?: string
  modeOverride?: string
  providerOverride?: string
  userId?: string
  product?: string
  env?: NodeJS.ProcessEnv
}

export async function executeChat({ messages }: SharedChatParams) {
  const last = [...messages].reverse().find((m) => m.role === 'user')
  return {
    text: last?.content ?? '',
    mode: 'gateway',
    latencyMs: 0,
    fallbackReason: null,
  }
}

export async function executeEmbedding({ input }: SharedEmbeddingParams) {
  return {
    embedding: Array.from({ length: 8 }, (_, i) => ((input.length + i) % 10) / 10),
    mode: 'gateway',
    latencyMs: 0,
    fallbackReason: null,
  }
}
