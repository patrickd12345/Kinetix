import { describe, expect, it, vi } from 'vitest'
import { buildAiLogFields, emitAiLog } from './ai'

describe('AI observability logging', () => {
  describe('buildAiLogFields', () => {
    it('builds fields correctly when no fallback occurred', () => {
      const result = buildAiLogFields({
        provider: 'openai',
        model: 'gpt-4',
        mode: 'chat',
        latencyMs: 150,
        fallbackReason: null,
      })

      expect(result).toMatchObject({
        provider: 'openai',
        model: 'gpt-4',
        mode: 'chat',
        latencyMs: 150,
        fallback: false,
        fallbackReason: null,
      })
    })

    it('sets fallback to true when fallbackReason is provided', () => {
      const result = buildAiLogFields({
        provider: 'openai',
        model: 'gpt-4',
        mode: 'chat',
        latencyMs: 200,
        fallbackReason: 'Rate limit exceeded',
      })

      expect(result).toMatchObject({
        fallback: true,
        fallbackReason: 'Rate limit exceeded',
      })
    })

    it('spreads additional fields into the result', () => {
      const result = buildAiLogFields(
        {
          provider: 'anthropic',
          model: 'claude-3',
          mode: 'completion',
          latencyMs: 100,
          fallbackReason: null,
        },
        {
          userId: 'usr_123',
          promptTokens: 50,
          completionTokens: 20,
        },
      )

      expect(result).toMatchObject({
        provider: 'anthropic',
        model: 'claude-3',
        mode: 'completion',
        latencyMs: 100,
        fallback: false,
        fallbackReason: null,
        userId: 'usr_123',
        promptTokens: 50,
        completionTokens: 20,
      })
    })
  })

  describe('emitAiLog', () => {
    it('emits a structured log with AI fields', () => {
      const sink = vi.fn()

      emitAiLog(
        'info',
        'ai_request',
        {
          provider: 'ollama',
          model: 'llama3',
          mode: 'generation',
          latencyMs: 50,
          fallbackReason: 'Service unavailable',
        },
        { surface: 'cli' },
        { sink },
      )

      expect(sink).toHaveBeenCalledTimes(1)
      const loggedObject = sink.mock.calls[0]?.[2]

      expect(loggedObject).toMatchObject({
        level: 'info',
        event: 'ai_request',
        provider: 'ollama',
        model: 'llama3',
        mode: 'generation',
        latencyMs: 50,
        fallback: true,
        fallbackReason: 'Service unavailable',
        surface: 'cli',
      })
    })
  })
})
