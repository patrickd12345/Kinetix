import { describe, expect, it } from 'vitest'
import { resolveAiRuntimeEnv, resolveCanonicalMode, resolveCanonicalProvider } from './env'

describe('resolveAiRuntimeEnv', () => {
  it('prefers canonical env names when available', () => {
    const resolved = resolveAiRuntimeEnv({
      AI_MODE: 'gateway',
      AI_PROVIDER: 'gateway',
      VERCEL_AI_BASE_URL: 'https://gateway.example.com/',
      VERCEL_VIRTUAL_KEY: 'vk_123',
      OPENAI_MODEL: 'gpt-4o-mini',
      OLLAMA_BASE_URL: 'http://localhost:11434/',
      OLLAMA_MODEL: 'llama3.2',
    })

    expect(resolved.mode).toBe('gateway')
    expect(resolved.provider).toBe('gateway')
    expect(resolved.gatewayBaseUrl).toBe('https://gateway.example.com')
    expect(resolved.gatewayApiKey).toBe('vk_123')
    expect(resolved.openAiModel).toBe('gpt-4o-mini')
    expect(resolved.ollamaBaseUrl).toBe('http://localhost:11434')
    expect(resolved.ollamaModel).toBe('llama3.2')
  })

  it('supports proven alias env names for compatibility', () => {
    const resolved = resolveAiRuntimeEnv({
      KINETIX_LLM_PROVIDER: 'ollama',
      AI_GATEWAY_BASE_URL: 'https://alias-gateway.example.com/',
      AI_GATEWAY_API_KEY: 'alias-key',
      AI_GATEWAY_MODEL: 'gpt-alias',
      OLLAMA_API_URL: 'http://127.0.0.1:11434/',
      LLM_MODEL: 'llama-alias',
    })

    expect(resolved.provider).toBe('ollama')
    expect(resolved.gatewayBaseUrl).toBe('https://alias-gateway.example.com')
    expect(resolved.gatewayApiKey).toBe('alias-key')
    expect(resolved.openAiModel).toBe('gpt-alias')
    expect(resolved.ollamaBaseUrl).toBe('http://127.0.0.1:11434')
    expect(resolved.ollamaModel).toBe('llama-alias')
  })
})

describe('resolveCanonicalMode', () => {
  it('maps local mode to ollama', () => {
    const mode = resolveCanonicalMode({ AI_MODE: 'local' })
    expect(mode).toBe('ollama')
  })

  it('forces gateway on Vercel when AI_PROVIDER is ollama', () => {
    expect(
      resolveCanonicalMode({
        VERCEL: '1',
        AI_PROVIDER: 'ollama',
      }),
    ).toBe('gateway')
  })
})

describe('gateway mode vs AI_PROVIDER', () => {
  it('uses gateway provider when mode is gateway even if AI_PROVIDER is ollama', () => {
    const env = {
      AI_MODE: 'gateway',
      AI_PROVIDER: 'ollama',
      VERCEL_AI_BASE_URL: 'https://gateway.example.com',
      VERCEL_VIRTUAL_KEY: 'vk_123',
    }
    const resolved = resolveAiRuntimeEnv(env)
    expect(resolved.mode).toBe('gateway')
    expect(resolved.provider).toBe('gateway')
  })

  it('maps modeOverride gateway + env ollama to gateway provider', () => {
    const env = {
      AI_PROVIDER: 'ollama',
      VERCEL_AI_BASE_URL: 'https://gateway.example.com',
      VERCEL_VIRTUAL_KEY: 'vk_123',
    }
    const mode = resolveCanonicalMode(env, 'gateway')
    const provider = resolveCanonicalProvider(env, mode)
    expect(mode).toBe('gateway')
    expect(provider).toBe('gateway')
  })
})
