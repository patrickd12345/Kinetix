import type { CanonicalChatMessage, ProviderChatResult, ProviderEmbeddingResult, ProviderError } from '../types'

type ExecuteOllamaChatParams = {
  baseUrl: string
  model: string
  messages: CanonicalChatMessage[]
  temperature?: number
  maxTokens?: number
  format?: 'json'
  fetchImpl: typeof fetch
}

type ExecuteOllamaEmbeddingParams = {
  baseUrl: string
  model: string
  input: string
  fetchImpl: typeof fetch
}

function createError(message: string, status?: number): ProviderError {
  const error = new Error(message) as ProviderError
  if (typeof status === 'number') {
    error.status = status
  }
  return error
}

export async function executeOllamaChat(params: ExecuteOllamaChatParams): Promise<ProviderChatResult> {
  const response = await params.fetchImpl(`${params.baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      stream: false,
      ...(params.format ? { format: params.format } : {}),
      options: {
        temperature: params.temperature ?? 0.7,
        num_predict: params.maxTokens ?? 1024,
      },
    }),
  })

  const raw = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (raw as { error?: string; message?: string }).error ??
      (raw as { message?: string }).message ??
      `Ollama chat request failed with status ${response.status}`
    throw createError(message, response.status)
  }

  const text =
    (raw as { message?: { content?: string } }).message?.content ??
    (raw as { response?: string }).response ??
    ''

  return { text, raw }
}

export async function executeOllamaEmbedding(params: ExecuteOllamaEmbeddingParams): Promise<ProviderEmbeddingResult> {
  const response = await params.fetchImpl(`${params.baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.input,
    }),
  })

  const raw = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      (raw as { error?: string; message?: string }).error ??
      (raw as { message?: string }).message ??
      `Ollama embedding request failed with status ${response.status}`
    throw createError(message, response.status)
  }

  const embedding = (raw as { embedding?: number[] }).embedding
  return { embedding: Array.isArray(embedding) ? embedding : [], raw }
}
