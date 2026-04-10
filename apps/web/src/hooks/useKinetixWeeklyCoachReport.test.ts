import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKinetixWeeklyCoachReport } from './useKinetixWeeklyCoachReport'

vi.mock('./useKinetixCoachingContext', () => ({
  KinetixCoachingContext: { Provider: ({ children }: { children: unknown }) => children },
  useOptionalKinetixCoachingContextFromProvider: () => null,
  useKinetixCoachingContextState: () => ({
    loading: false,
    error: null,
    data: {
      goal: null,
      goalProgress: null,
      intelligence: null,
      prediction: null,
      periodization: { phase: 'base', weeksRemaining: 8, nextPhase: 'build', focus: '' },
      loadControl: null,
      coach: null,
      trainingPlan: null,
      raceSimulation: null,
      sufficiency: {
        hasIntelligence: false,
        hasPrediction: false,
        hasRuns: false,
        hasCoachInputs: false,
      },
    },
  }),
  useKinetixCoachingContext: () => ({
    loading: false,
    error: null,
    data: {
      goal: null,
      goalProgress: null,
      intelligence: null,
      prediction: null,
      periodization: { phase: 'base', weeksRemaining: 8, nextPhase: 'build', focus: '' },
      loadControl: null,
      coach: null,
      trainingPlan: null,
      raceSimulation: null,
      sufficiency: {
        hasIntelligence: false,
        hasPrediction: false,
        hasRuns: false,
        hasCoachInputs: false,
      },
    },
  }),
}))

vi.mock('./useKinetixCoachExplanation', () => ({
  useKinetixCoachExplanation: () => ({ explanation: null }),
}))

vi.mock('./useKinetixCoachMemory', () => ({
  useKinetixCoachMemory: () => ({ memory: null }),
}))

vi.mock('./useKinetixRaceReadiness', () => ({
  useKinetixRaceReadiness: () => ({ readiness: null }),
}))

vi.mock('./useKinetixCoachAlerts', () => ({
  useKinetixCoachAlerts: () => ({ alerts: { alerts: [] } }),
}))

describe('useKinetixWeeklyCoachReport', () => {
  it('returns insufficient-data state when coach is unavailable', () => {
    const { result } = renderHook(() => useKinetixWeeklyCoachReport())
    expect(result.current.report).toBeNull()
    expect(result.current.insufficientData).toBe(true)
  })
})
