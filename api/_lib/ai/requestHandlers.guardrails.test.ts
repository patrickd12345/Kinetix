import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeChatMock = vi.hoisted(() => vi.fn())

vi.mock('./llmClient.js', () => ({
  getLLMClient: () => ({
    provider: 'gateway',
    model: 'test-model',
    executeChat: executeChatMock,
  }),
}))

import { handleAiChatRequest } from './requestHandlers.js'

function coachGuardrails() {
  return {
    mode: 'coach' as const,
    templateHint: 'auto' as const,
    contract: {
      verifiedFacts: {
        unitSystem: 'metric',
        dataAvailability: {
          hasRetrievedRuns: true,
          hasPbTargets: false,
        },
        retrievedRunCount: 1,
        retrievedRuns: [{ distanceDisplay: '5.00 km', paceDisplay: '5:33/km', kps: 87 }],
        pbPaceToBeat: null,
      },
      userStatedFacts: {
        numericMentions: [],
      },
      allowedOutputModes: [
        'explanation',
        'comparison',
        'coaching_summary',
        'motivation',
        'insufficient_data',
        'verified_math',
      ],
      forbiddenOperations: [
        'invent_numbers',
        'introduce_new_numeric_value',
        'derive_new_numeric_target',
        'modify_verified_values',
        'infer_missing_inputs',
        'medical_diagnosis',
        'unsupported_prediction',
        'future_performance_prediction',
        'physiological_claim',
        'injury_prediction',
        'training_effect_prediction',
        'performance_ranking_claim',
        'trend_claim',
        'improvement_claim',
        'regression_claim',
      ],
      provenance: [],
    },
  }
}

describe('handleAiChatRequest coach guardrails', () => {
  beforeEach(() => {
    executeChatMock.mockReset()
  })

  it('activates coach guardrails and blocks unsupported predictions', async () => {
    executeChatMock.mockResolvedValue({
      text: 'You will likely run 22:10 soon.',
      provider: 'gateway',
      model: 'test-model',
      mode: 'gateway',
      latencyMs: 5,
      fallbackReason: null,
    })

    const result = await handleAiChatRequest(
      {
        systemInstruction: 'Coach safely.',
        contents: [{ parts: [{ text: 'How am I doing?' }] }],
        guardrails: coachGuardrails(),
      },
      {},
    )

    expect('text' in result).toBe(true)
    if ('text' in result) {
      expect(result.text).not.toMatch(/22:10|likely run|soon/i)
      expect(result.fallbackReason).toMatch(/coach_guardrail_(?:fallback|stripped)/)
    }
  })

  it('leaves non-coach ai-chat responses unchanged', async () => {
    executeChatMock.mockResolvedValue({
      text: 'You will likely run 22:10 soon.',
      provider: 'gateway',
      model: 'test-model',
      mode: 'gateway',
      latencyMs: 5,
      fallbackReason: null,
    })

    const result = await handleAiChatRequest(
      {
        systemInstruction: 'General assistant.',
        contents: [{ parts: [{ text: 'Hello' }] }],
      },
      {},
    )

    expect('text' in result).toBe(true)
    if ('text' in result) {
      expect(result.text).toContain('22:10')
      expect(result.fallbackReason).toBeNull()
    }
  })

  it('uses the verified math scaffold in coach mode', async () => {
    executeChatMock.mockResolvedValue({
      text: 'Your verified pace was 5:00/km.',
      provider: 'gateway',
      model: 'test-model',
      mode: 'gateway',
      latencyMs: 5,
      fallbackReason: null,
    })

    const result = await handleAiChatRequest(
      {
        systemInstruction: 'Coach safely.',
        contents: [{ parts: [{ text: 'What is my pace for 5 km in 25:00?' }] }],
        userProfile: { age: 35, weightKg: 70 },
        unitSystem: 'metric',
        guardrails: coachGuardrails(),
      },
      {},
    )

    expect('text' in result).toBe(true)
    if ('text' in result) {
      expect(result.text).toContain('Result:')
      expect(result.text).toContain('Confidence:')
      expect(result.text).toContain('5:00/km')
    }
  })
})
