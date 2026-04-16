import { describe, expect, it } from 'vitest'
import { executeChat, executeEmbedding } from './runtime'

describe('executeChat', () => {
  it('returns canonical metadata for gateway mode', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello from gateway' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )

    const result = await executeChat({
      messages: [{ role: 'user', content: 'hi' }],
      env: {
        AI_MODE: 'gateway',
        AI_PROVIDER: 'gateway',
        VERCEL_AI_BASE_URL: 'https://ai-gateway.vercel.sh',
        VERCEL_VIRTUAL_KEY: 'vk_test',
        OPENAI_MODEL: 'gpt-4o-mini',
      },
      fetchImpl,
    })

    expect(result.text).toBe('hello from gateway')
    expect(result.provider).toBe('gateway')
    expect(result.model).toBe('gpt-4o-mini')
    expect(result.mode).toBe('gateway')
    expect(typeof result.latencyMs).toBe('number')
    expect(result.fallbackReason).toBeNull()
  })

  it('falls back from gateway to ollama in fallback mode', async () => {
    let callCount = 0
    const fetchImpl: typeof fetch = async (input) => {
      callCount += 1
      const url = String(input)
      if (url.includes('/v1/chat/completions')) {
        return new Response(
          JSON.stringify({ message: 'gateway unavailable' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({ message: { content: 'hello from ollama fallback' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const result = await executeChat({
      messages: [{ role: 'user', content: 'fallback please' }],
      env: {
        AI_MODE: 'fallback',
        AI_PROVIDER: 'gateway',
        VERCEL_AI_BASE_URL: 'https://ai-gateway.vercel.sh',
        VERCEL_VIRTUAL_KEY: 'vk_test',
        OLLAMA_BASE_URL: 'http://localhost:11434',
      },
      fetchImpl,
    })

    expect(callCount).toBe(2)
    expect(result.text).toBe('hello from ollama fallback')
    expect(result.provider).toBe('ollama')
    expect(result.mode).toBe('fallback')
    expect(result.fallbackReason).toContain('gateway unavailable')
  })
})

describe('executeEmbedding', () => {
  it('returns canonical metadata for ollama mode', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({ embedding: [0.1, 0.2, 0.3] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )

    const result = await executeEmbedding({
      input: 'hello',
      modeOverride: 'local',
      env: {
        OLLAMA_BASE_URL: 'http://localhost:11434',
        OLLAMA_MODEL: 'llama3.2',
      },
      fetchImpl,
    })

    expect(result.embedding).toEqual([0.1, 0.2, 0.3])
    expect(result.provider).toBe('ollama')
    expect(result.model).toBe('llama3.2')
    expect(result.mode).toBe('ollama')
    expect(result.fallbackReason).toBeNull()
  })
})
