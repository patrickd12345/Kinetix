import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import History from './History'
import * as coachingContextModule from '../hooks/useKinetixCoachingContext'
import { useKinetixCoach } from '../hooks/useKinetixCoach'

vi.mock('../components/providers/useAuth', () => ({
  useAuth: () => ({ profile: null }),
}))

vi.mock('../hooks/useStableKinetixUserProfile', () => ({
  useStableKinetixUserProfile: () => null,
}))

vi.mock('../hooks/useAICoach', () => ({
  useAICoach: () => ({
    isAnalyzing: false,
    aiResult: null,
    error: null,
    analyzeRun: vi.fn(),
    clearResult: vi.fn(),
  }),
}))

vi.mock('../lib/database', () => ({
  db: { runs: { get: vi.fn(async () => null) } },
  getRunsPage: vi.fn(async () => ({ items: [], total: 0 })),
  getRunsPageForDate: vi.fn(async () => ({ items: [], total: 0 })),
  getRunsInDateRange: vi.fn(async () => []),
  getWeightsForDates: vi.fn(async () => new Map()),
  getAllVisibleRunsOrdered: vi.fn(async () => []),
  RUN_VISIBLE: 1,
}))

vi.mock('../components/KPSTrendChart', () => ({ KPSTrendChart: () => null }))
vi.mock('../components/RunDetails', () => ({ RunDetails: () => null }))
vi.mock('../components/RunCalendar', () => ({ RunCalendar: () => null }))

const fakeContext: coachingContextModule.KinetixCoachingContextResult = {
  loading: false,
  error: null,
  data: {
    goal: null,
    goalProgress: null,
    intelligence: null,
    prediction: null,
    periodization: { phase: 'base', weeksRemaining: 0, nextPhase: null, focus: '' },
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
}

function FallbackConsumer() {
  useKinetixCoach()
  return null
}

describe('History provider integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses provider-backed context without duplicate context builds in coaching stack', () => {
    const spy = vi
      .spyOn(coachingContextModule, 'useKinetixCoachingContext')
      .mockReturnValue(fakeContext)

    render(<History />)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Not enough data for race readiness yet.')).toBeInTheDocument()
    expect(screen.getByText('No coaching alerts right now.')).toBeInTheDocument()
    expect(screen.getByText('Not enough data for weekly coach report yet.')).toBeInTheDocument()
  })

  it('falls back to direct context hook when provider is absent', () => {
    const spy = vi
      .spyOn(coachingContextModule, 'useKinetixCoachingContext')
      .mockReturnValue(fakeContext)

    render(<FallbackConsumer />)

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
