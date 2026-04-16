import { describe, expect, it, vi } from 'vitest'
import { buildAiLogFields, emitAiLog } from './ai'

describe('AI Observability', () => {
  describe('buildAiLogFields', () => {
    it('builds standard AI log fields on happy path', () => {
      const metadata = {
        provider: 'openai',
        model: 'gpt-4o',
        mode: 'chat',
        latencyMs: 150,
        fallbackReason: null,
      }

      const result = buildAiLogFields(metadata)

      expect(result).toStrictEqual({
        provider: 'openai',
        model: 'gpt-4o',
        mode: 'chat',
        latencyMs: 150,
        fallback: false,
        fallbackReason: null,
      })
    })

    it('evaluates fallback correctly when fallbackReason is provided', () => {
      const metadata = {
        provider: 'anthropic',
        model: 'claude-3-opus',
        mode: 'completion',
        latencyMs: 300,
        fallbackReason: 'Rate limit exceeded',
      }

      const result = buildAiLogFields(metadata)

      expect(result.fallback).toBe(true)
      expect(result.fallbackReason).toBe('Rate limit exceeded')
    })

    it('evaluates fallback correctly when fallbackReason is an empty string', () => {
      const metadata = {
        provider: 'anthropic',
        model: 'claude-3-opus',
        mode: 'completion',
        latencyMs: 300,
        fallbackReason: '',
      }

      const result = buildAiLogFields(metadata)

      // An empty string is not null, so fallback should be true
      expect(result.fallback).toBe(true)
      expect(result.fallbackReason).toBe('')
    })

    it('merges custom fields correctly', () => {
      const metadata = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        mode: 'chat',
        latencyMs: 100,
        fallbackReason: null,
      }

      const customFields = {
        userId: 'user_123',
        promptTokens: 50,
        completionTokens: 20,
        isTrial: true,
      }

      const result = buildAiLogFields(metadata, customFields)

      expect(result).toStrictEqual({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        mode: 'chat',
        latencyMs: 100,
        fallback: false,
        fallbackReason: null,
        userId: 'user_123',
        promptTokens: 50,
        completionTokens: 20,
        isTrial: true,
      })
    })

    it('custom fields overwrite protected fields based on current implementation', () => {
      // The current implementation uses `...fields` last, which means custom fields
      // will overwrite the standard fields. We lock the test to this actual intended contract.
      const metadata = {
        provider: 'openai',
        model: 'gpt-4',
        mode: 'chat',
        latencyMs: 200,
        fallbackReason: null,
      }

      const customFields = {
        provider: 'custom_provider', // Attempt to overwrite
        fallback: true,             // Attempt to overwrite calculated field
        customProp: 'value',
      }

      const result = buildAiLogFields(metadata, customFields)

      expect(result.provider).toBe('custom_provider')
      expect(result.fallback).toBe(true)
      expect(result.customProp).toBe('value')
    })

    it('handles missing optional custom fields parameter', () => {
      const metadata = {
        provider: 'openai',
        model: 'gpt-4o',
        mode: 'chat',
        latencyMs: 150,
        fallbackReason: null,
      }

      // Omitting the second argument completely
      const result = buildAiLogFields(metadata)

      expect(Object.keys(result)).toHaveLength(6)
      expect(result.provider).toBe('openai')
    })

    it('preserves numeric and boolean custom fields correctly', () => {
      const metadata = {
        provider: 'openai',
        model: 'gpt-4o',
        mode: 'chat',
        latencyMs: 0,
        fallbackReason: null,
      }

      const result = buildAiLogFields(metadata, {
        count: 0,
        temperature: 0.5,
        isActive: false,
        isEnabled: true,
      })

      expect(result.latencyMs).toBe(0)
      expect(result.count).toBe(0)
      expect(result.temperature).toBe(0.5)
      expect(result.isActive).toBe(false)
      expect(result.isEnabled).toBe(true)
    })
  })

  describe('emitAiLog', () => {
    it('emits the expected shape through the sink', () => {
      const sink = vi.fn()
      const metadata = {
        provider: 'ollama',
        model: 'llama3',
        mode: 'local',
        latencyMs: 50,
        fallbackReason: null,
      }

      emitAiLog('info', 'ai.generation', metadata, { surface: 'cli' }, { sink })

      expect(sink).toHaveBeenCalledTimes(1)
      expect(sink).toHaveBeenCalledWith(
        'info',
        expect.any(String),
        expect.objectContaining({
          event: 'ai.generation',
          level: 'info',
          provider: 'ollama',
          model: 'llama3',
          mode: 'local',
          latencyMs: 50,
          fallback: false,
          fallbackReason: null,
          surface: 'cli',
        })
      )
    })

    it('behaves safely when optional fields and options are missing', () => {
      const metadata = {
        provider: 'ollama',
        model: 'llama3',
        mode: 'local',
        latencyMs: 50,
        fallbackReason: null,
      }

      // Should not throw when omitted
      expect(() => {
        emitAiLog('info', 'ai.test', metadata)
      }).not.toThrow()
    })

    it('does not mutate caller-provided objects', () => {
      const sink = vi.fn()
      const metadata = {
        provider: 'ollama',
        model: 'llama3',
        mode: 'local',
        latencyMs: 50,
        fallbackReason: null,
      }
      const originalMetadata = { ...metadata }

      const customFields = { surface: 'cli', tags: ['local'] }
      const originalCustomFields = { ...customFields }

      emitAiLog('info', 'ai.generation', metadata, customFields, { sink })

      // Ensure the caller objects weren't modified
      expect(metadata).toStrictEqual(originalMetadata)
      expect(customFields).toStrictEqual(originalCustomFields)
    })
  })
})
