import { describe, expect, it } from 'vitest'
import type { CoachGuardrailPayload, VerifiedMathResult } from '@kinetix/core'
import { applyCoachResponseGuardrails } from './coachResponseGuardrails.js'

function baseGuardrails(): CoachGuardrailPayload {
  return {
    mode: 'coach',
    templateHint: 'auto',
    contract: {
      verifiedFacts: {
        unitSystem: 'metric',
        dataAvailability: {
          hasRetrievedRuns: true,
          hasPbTargets: true,
        },
        retrievedRunCount: 2,
        retrievedRuns: [
          { distanceDisplay: '5.00 km', paceDisplay: '5:33/km', kps: 87 },
          { distanceDisplay: '10.00 km', paceDisplay: '5:40/km', kps: 84 },
        ],
        pbPaceToBeat: {
          fiveKDisplay: '5:20/km',
          tenKDisplay: '5:32/km',
        },
      },
      userStatedFacts: {
        numericMentions: ['12'],
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

function verifiedMathResult(): VerifiedMathResult {
  return {
    type: 'verified_math_result',
    operation: 'pace_from_time_distance',
    canAnswer: true,
    inputs: { distanceM: 5000, timeSeconds: 1500 },
    outputs: { paceSecondsPerKm: 300 },
    formatted: {
      paceDisplay: '5:00/km',
      narrative: 'Average pace is 5:00/km.',
    },
  }
}

describe('applyCoachResponseGuardrails', () => {
  it('strips invented numbers from the final response', () => {
    const outcome = applyCoachResponseGuardrails({
      draftText: 'Your verified pace was 5:33/km. You could aim for 5:15/km next.',
      userContent: 'How am I doing?',
      unitSystem: 'metric',
      guardrails: baseGuardrails(),
    })

    expect(outcome.text).toContain('5:33/km')
    expect(outcome.text).not.toContain('5:15/km')
    expect(outcome.fallbackReason).toBe('coach_guardrail_stripped')
  })

  it('falls back when the draft is only an unsupported prediction', () => {
    const outcome = applyCoachResponseGuardrails({
      draftText: 'You will likely run 22:10 soon.',
      userContent: 'Predict my 5K',
      unitSystem: 'metric',
      guardrails: baseGuardrails(),
    })

    expect(outcome.text).not.toMatch(/22:10|likely run|soon/i)
    expect(outcome.fallbackReason).toMatch(/coach_guardrail_(?:fallback|stripped)/)
  })

  it('blocks unsupported diagnostic and physiology claims', () => {
    const outcome = applyCoachResponseGuardrails({
      draftText: 'You are clearly overtrained and this improves your VO2 max.',
      userContent: 'What does this mean?',
      unitSystem: 'metric',
      guardrails: baseGuardrails(),
    })

    expect(outcome.text).not.toMatch(/overtrained|VO2/i)
    expect(outcome.fallbackReason).toMatch(/coach_guardrail_(?:fallback|stripped)/)
  })

  it('blocks unsupported trend claims', () => {
    const outcome = applyCoachResponseGuardrails({
      draftText: 'Your last runs show progress and your pace trend is upward.',
      userContent: 'Am I improving?',
      unitSystem: 'metric',
      guardrails: baseGuardrails(),
    })

    expect(outcome.text).not.toMatch(/show progress|trend is upward/i)
    expect(outcome.fallbackReason).toMatch(/coach_guardrail_(?:fallback|stripped)/)
  })

  it('uses the verified math scaffold unchanged for safe explanations', () => {
    const outcome = applyCoachResponseGuardrails({
      draftText: 'Your verified pace was 5:00/km.',
      userContent: 'What is my pace for 5 km in 25:00?',
      unitSystem: 'metric',
      guardrails: baseGuardrails(),
      verifiedMathResult: verifiedMathResult(),
    })

    expect(outcome.text).toContain('Result:')
    expect(outcome.text).toContain('Confidence:')
    expect(outcome.text).toContain('5:00/km')
  })

  it('allows repeated user-provided numbers when clearly attributed', () => {
    const outcome = applyCoachResponseGuardrails({
      draftText: 'You said 12 km.',
      userContent: 'I ran 12 km today.',
      unitSystem: 'metric',
      guardrails: baseGuardrails(),
    })

    expect(outcome.text).toContain('You said 12 km.')
  })

  it('keeps hedged coaching language as the next action', () => {
    const outcome = applyCoachResponseGuardrails({
      draftText: 'Your retrieved runs are consistent. You may want an easier next session.',
      userContent: 'How am I doing?',
      unitSystem: 'metric',
      guardrails: baseGuardrails(),
    })

    expect(outcome.text).toContain('Next action:')
    expect(outcome.text).toContain('You may want an easier next session.')
  })

  it('uses the comparison scaffold for explicit comparison prompts', () => {
    const outcome = applyCoachResponseGuardrails({
      draftText: 'The first retrieved run was slower than the second.',
      userContent: 'Compare these runs for me.',
      unitSystem: 'metric',
      guardrails: baseGuardrails(),
    })

    expect(outcome.templateKind).toBe('comparison')
    expect(outcome.text).toContain('Comparison:')
  })
})
