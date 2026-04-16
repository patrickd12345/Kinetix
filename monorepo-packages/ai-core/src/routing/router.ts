import { resolveKey } from '../byok/keyResolver.js'
import { anthropicChat } from '../providers/anthropic.js'
import { geminiChat } from '../providers/gemini.js'
import { openaiChat } from '../providers/openai.js'
import type { ChatMessage, ProviderCallOptions, ProviderGenerateResult } from '../providers/types.js'
import { recordAiCoreTelemetry } from '../telemetry.js'

export type GenerateInput = {
  userId: string
  provider: 'openai' | 'anthropic' | 'gemini'
  product: string
  model: string
  /** Chat payload */
  input: { messages: ChatMessage[] }
  options?: ProviderCallOptions
  fetchImpl?: typeof fetch
}

export type GenerateResult = ProviderGenerateResult & {
  keySource: 'user' | 'platform'
  provider: string
  model: string
}

/**
 * High-level generate: resolves BYOK vs platform key, dispatches to the matching provider.
 */
export async function generate(params: GenerateInput): Promise<GenerateResult> {
  const { apiKey, source } = await resolveKey({
    userId: params.userId,
    provider: params.provider,
    product: params.product,
  })

  let fallbackUsed = false
  try {
    let result: ProviderGenerateResult
    switch (params.provider) {
      case 'openai':
        result = await openaiChat({
          apiKey,
          model: params.model,
          messages: params.input.messages,
          options: params.options,
          fetchImpl: params.fetchImpl,
        })
        break
      case 'anthropic':
        result = await anthropicChat({
          apiKey,
          model: params.model,
          messages: params.input.messages,
          options: params.options,
          fetchImpl: params.fetchImpl,
        })
        break
      case 'gemini':
        result = await geminiChat({
          apiKey,
          model: params.model,
          messages: params.input.messages,
          options: params.options,
          fetchImpl: params.fetchImpl,
        })
        break
      default:
        throw new Error(`Unsupported provider: ${(params as { provider: string }).provider}`)
    }

    recordAiCoreTelemetry({
      keySource: source,
      provider: params.provider,
      model: params.model,
      fallbackUsed,
      outcome: 'success',
    })

    return {
      ...result,
      keySource: source,
      provider: params.provider,
      model: params.model,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    recordAiCoreTelemetry({
      keySource: source,
      provider: params.provider,
      model: params.model,
      fallbackUsed,
      outcome: 'failure',
      errorMessage: msg,
    })
    throw error
  }
}
