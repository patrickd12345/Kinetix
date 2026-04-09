import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  KinetixCoachingContextProvider,
  useKinetixCoachingContextFromProvider,
} from './KinetixCoachingContextProvider'
import { useKinetixCoach } from '../hooks/useKinetixCoach'

vi.mock('../hooks/useKinetixCoachingContext', () => ({
  useKinetixCoachingContext: () => ({
    loading: false,
    error: null,
    data: {
      goal: null,
      goalProgress: null,
      intelligence: null,
      prediction: null,
      periodization: { phase: 'base', weeksRemaining: 0, nextPhase: null, focus: '' },
      loadControl: null,
      coach: { decision: 'maintain', reason: 'stable', confidence: 'low' },
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

function ProviderProbe() {
  const context = useKinetixCoachingContextFromProvider()
  return <div>{context.data.coach?.decision ?? 'none'}</div>
}

function FallbackProbe() {
  const { coach } = useKinetixCoach()
  return <div>{coach?.decision ?? 'none'}</div>
}

describe('KinetixCoachingContextProvider', () => {
  it('provider supplies context deterministically', () => {
    render(
      <KinetixCoachingContextProvider>
        <ProviderProbe />
      </KinetixCoachingContextProvider>
    )
    expect(screen.getByText('maintain')).toBeInTheDocument()
  })

  it('fallback works when provider is absent', () => {
    render(<FallbackProbe />)
    expect(screen.getByText('maintain')).toBeInTheDocument()
  })

  it('throws deterministic error when provider hook used without provider', () => {
    expect(() => render(<ProviderProbe />)).toThrow(
      'KinetixCoachingContextProvider is required for this hook.'
    )
  })
})
