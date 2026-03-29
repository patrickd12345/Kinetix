import { executeChat as executeSharedChat, executeEmbedding as executeSharedEmbedding } from '@bookiji-inc/ai-runtime'
import { resolveKinetixRuntimeEnvFromObject } from '../../../../api/_lib/env/runtime.shared.mjs'

const runtimeConsole = globalThis.console ?? console

function getEnv() {
  return undefined
}

function resolveProvider(env = getEnv()) {
  return resolveKinetixRuntimeEnvFromObject(env).aiProvider
}

function resolveModel(env, provider) {
  const runtime = resolveKinetixRuntimeEnvFromObject(env)
  if (provider === 'gateway') {
    return runtime.openAiModel
  }
  return runtime.ollamaModel
}

async function executeOllamaGenerate(baseUrl, model, messages, options) {
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
    const err = new Error(`Ollama API error: ${res.status}`)
    err.status = res.status
    throw err
  }
  const data = await res.json()
  return { text: (data.response || '').trim() }
}

function isProviderError(error) {
  return error instanceof Error
}

function getLLMClient(env = getEnv()) {
  const provider = resolveProvider(env)
  const model = resolveModel(env, provider)
  const runtime = resolveKinetixRuntimeEnvFromObject(env)

  async function executeChat(messages, options = {}) {
    const startedAt = Date.now()
    const effectiveModel = options.model ?? model
    runtimeConsole.info('[LLM]', { provider, model: effectiveModel, mode: provider })

    try {
      const result = await executeSharedChat({
        messages,
        model: effectiveModel,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1024,
        modeOverride: provider,
        providerOverride: provider,
        env,
      })

      return {
        text: result.text,
        provider,
        model: effectiveModel,
        mode: result.mode,
        latencyMs: result.latencyMs,
        fallbackReason: result.fallbackReason,
      }
    } catch (error) {
      if (provider === 'ollama' && isProviderError(error) && error.status === 500) {
        const generated = await executeOllamaGenerate(
          runtime.ollamaBaseUrl || 'http://localhost:11434',
          effectiveModel,
          messages,
          options,
        )
        return {
          ...generated,
          provider,
          model: effectiveModel,
          mode: 'ollama',
          latencyMs: Date.now() - startedAt,
          fallbackReason: 'ollama_chat_failed_generate_fallback',
        }
      }
      throw error
    }
  }

  async function executeEmbedding(input, options = {}) {
    const effectiveModel =
      options.model ??
      (provider === 'gateway' ? runtime.openAiModel || 'text-embedding-3-small' : model)

    const result = await executeSharedEmbedding({
      input,
      model: effectiveModel,
      modeOverride: provider,
      providerOverride: provider,
      env,
    })

    return {
      embedding: result.embedding,
      provider,
      model: effectiveModel,
      mode: result.mode,
      latencyMs: result.latencyMs,
      fallbackReason: result.fallbackReason,
    }
  }

  return { provider, model, executeChat, executeEmbedding }
}

export { getLLMClient, resolveProvider, resolveModel }
