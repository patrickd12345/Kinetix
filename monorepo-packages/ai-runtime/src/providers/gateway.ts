import type { CanonicalChatMessage, ProviderChatResult, ProviderEmbeddingResult, ProviderError } from '../types'

type ExecuteGatewayChatParams = {
  baseUrl: string
  apiKey: string | null
  model: string
  messages: CanonicalChatMessage[]
  temperature?: number
  maxTokens?: number
  byokKey?: string | null
  fetchImpl: typeof fetch
}

type ExecuteGatewayEmbeddingParams = {
  baseUrl: string
  apiKey: string | null
  model: string
  input: string
  byokKey?: string | null
  fetchImpl: typeof fetch
}

function createError(message: string, status?: number): ProviderError {
  const error = new Error(message) as ProviderError
  if (typeof status === 'number') {
    error.status = status
  }
  return error
}

function withGatewayByok(byokKey?: string | null): Record<string, unknown> {
  if (!byokKey || !byokKey.trim()) {
    return {}
  }
  return {
    providerOptions: {
      gateway: {
        byok: {
          openai: [{ apiKey: byokKey.trim() }],
        },
      },
    },
  }
}

export async function executeGatewayChat(params: ExecuteGatewayChatParams): Promise<ProviderChatResult> {
  if (!params.apiKey) {
    throw createError('Gateway mode requires VERCEL_VIRTUAL_KEY (or alias).', 500)
  }

  const response = await params.fetchImpl(`${params.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
      stream: false,
      ...withGatewayByok(params.byokKey),
    }),
  })

  const raw = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (raw as { error?: { message?: string } }).error?.message ??
      (raw as { message?: string }).message ??
      `Gateway chat request failed with status ${response.status}`
    throw createError(message, response.status)
  }

  const text = (raw as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? ''
  return { text, raw }
}

export async function executeGatewayEmbedding(params: ExecuteGatewayEmbeddingParams): Promise<ProviderEmbeddingResult> {
  if (!params.apiKey) {
    throw createError('Gateway mode requires VERCEL_VIRTUAL_KEY (or alias).', 500)
  }

  const response = await params.fetchImpl(`${params.baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      input: params.input,
      ...withGatewayByok(params.byokKey),
    }),
  })

  const raw = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (raw as { error?: { message?: string } }).error?.message ??
      (raw as { message?: string }).message ??
      `Gateway embedding request failed with status ${response.status}`
    throw createError(message, response.status)
  }

  const embedding = (raw as { data?: Array<{ embedding?: number[] }> }).data?.[0]?.embedding
  return { embedding: Array.isArray(embedding) ? embedding : [], raw }
}
