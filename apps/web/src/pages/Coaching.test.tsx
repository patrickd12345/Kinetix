import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import Coaching, { CoachingStack } from './Coaching'
import * as coachingContextModule from '../hooks/useKinetixCoachingContext'
import { KinetixCoachingContextProvider } from '../context/KinetixCoachingContextProvider'
import type { KinetixCoachingContextResult } from '../hooks/useKinetixCoachingContext'

const ctxMocks = vi.hoisted(() => {
  const fakeContext: KinetixCoachingContextResult = {
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
  return { fakeContext }
})

vi.mock('../hooks/useKinetixCoachingContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useKinetixCoachingContext')>()
  return {
    ...actual,
    useKinetixCoachingContextState: vi.fn(() => ctxMocks.fakeContext),
    useKinetixCoachingContext: vi.fn(() => ctxMocks.fakeContext),
  }
})

const cardOrder: string[] = []

vi.mock('../components/KinetixCoachCard', () => ({
  KinetixCoachCard: () => {
    cardOrder.push('KinetixCoachCard')
    return <div data-testid="card-coach" />
  },
}))
vi.mock('../components/KinetixCoachExplanationCard', () => ({
  KinetixCoachExplanationCard: () => {
    cardOrder.push('KinetixCoachExplanationCard')
    return <div />
  },
}))
vi.mock('../components/KinetixRaceReadinessCard', () => ({
  KinetixRaceReadinessCard: () => {
    cardOrder.push('KinetixRaceReadinessCard')
    return <div />
  },
}))
vi.mock('../components/KinetixCoachAlertsCard', () => ({
  KinetixCoachAlertsCard: () => {
    cardOrder.push('KinetixCoachAlertsCard')
    return <div />
  },
}))
vi.mock('../components/KinetixWeeklyCoachReportCard', () => ({
  KinetixWeeklyCoachReportCard: () => {
    cardOrder.push('KinetixWeeklyCoachReportCard')
    return <div />
  },
}))
vi.mock('../components/KinetixTimelineCard', () => ({
  KinetixTimelineCard: () => {
    cardOrder.push('KinetixTimelineCard')
    return <div />
  },
}))
vi.mock('../components/KinetixGoalProbabilityCard', () => ({
  KinetixGoalProbabilityCard: () => {
    cardOrder.push('KinetixGoalProbabilityCard')
    return <div />
  },
}))
vi.mock('../components/KinetixGoalProgressCard', () => ({
  KinetixGoalProgressCard: () => {
    cardOrder.push('KinetixGoalProgressCard')
    return <div />
  },
}))
vi.mock('../components/KinetixRaceSimulationCard', () => ({
  KinetixRaceSimulationCard: () => {
    cardOrder.push('KinetixRaceSimulationCard')
    return <div />
  },
}))
vi.mock('../components/KinetixPeriodizationCard', () => ({
  KinetixPeriodizationCard: () => {
    cardOrder.push('KinetixPeriodizationCard')
    return <div />
  },
}))
vi.mock('../components/KinetixLoadControlCard', () => ({
  KinetixLoadControlCard: () => {
    cardOrder.push('KinetixLoadControlCard')
    return <div />
  },
}))
vi.mock('../components/KinetixTrainingPlanCard', () => ({
  KinetixTrainingPlanCard: () => {
    cardOrder.push('KinetixTrainingPlanCard')
    return <div />
  },
}))
vi.mock('../components/KinetixTrainingCalendarCard', () => ({
  KinetixTrainingCalendarCard: () => {
    cardOrder.push('KinetixTrainingCalendarCard')
    return <div />
  },
}))
vi.mock('../components/KinetixIntelligenceCard', () => ({
  KinetixIntelligenceCard: () => {
    cardOrder.push('KinetixIntelligenceCard')
    return <div />
  },
}))
vi.mock('../components/KinetixCoachMemoryCard', () => ({
  KinetixCoachMemoryCard: () => {
    cardOrder.push('KinetixCoachMemoryCard')
    return <div />
  },
}))

vi.mock('../hooks/useKinetixIntelligence', () => ({
  useKinetixIntelligence: () => ({
    loading: false,
    error: null,
    result: null,
    samples: [],
  }),
}))
vi.mock('../hooks/useKinetixTrainingPlan', () => ({
  useKinetixTrainingPlanFromIntelligence: () => ({
    loading: false,
    error: null,
    plan: null,
    goalProgress: null,
  }),
}))
vi.mock('../hooks/useKinetixRaceSimulation', () => ({
  useKinetixRaceSimulation: () => ({
    loading: false,
    error: null,
    simulation: null,
  }),
}))
vi.mock('../hooks/useKinetixPeriodization', () => ({
  useKinetixPeriodization: () => ({
    loading: false,
    error: null,
    periodization: null,
    isGoalDriven: false,
  }),
}))
vi.mock('../hooks/useKinetixLoadControl', () => ({
  useKinetixLoadControl: () => ({
    loading: false,
    error: null,
    loadControl: null,
  }),
}))
vi.mock('../hooks/useKinetixCoachExplanation', () => ({
  useKinetixCoachExplanation: () => ({
    loading: false,
    error: null,
    explanation: null,
    insufficientData: true,
  }),
}))
vi.mock('../hooks/useKinetixCoachMemory', () => ({
  useKinetixCoachMemory: () => ({
    loading: false,
    error: null,
    memory: null,
    insufficientData: true,
  }),
}))
vi.mock('../hooks/useKinetixRaceReadiness', () => ({
  useKinetixRaceReadiness: () => ({
    loading: false,
    error: null,
    readiness: null,
    insufficientData: true,
  }),
}))
vi.mock('../hooks/useKinetixCoachAlerts', () => ({
  useKinetixCoachAlerts: () => ({
    loading: false,
    error: null,
    alerts: [],
    insufficientData: true,
  }),
}))
vi.mock('../hooks/useKinetixWeeklyCoachReport', () => ({
  useKinetixWeeklyCoachReport: () => ({
    loading: false,
    error: null,
    report: null,
    insufficientData: true,
  }),
}))
vi.mock('../hooks/useKinetixTimeline', () => ({
  useKinetixTimeline: () => ({
    loading: false,
    error: null,
    timeline: null,
    insufficientData: true,
  }),
}))
vi.mock('../hooks/useKinetixGoalProbability', () => ({
  useKinetixGoalProbability: () => ({
    loading: false,
    error: null,
    goalProbability: null,
    insufficientData: true,
  }),
}))
vi.mock('../hooks/useKinetixTrainingCalendar', () => ({
  useKinetixTrainingCalendar: () => ({
    loading: false,
    error: null,
    calendar: null,
    insufficientData: true,
  }),
}))

describe('Coaching page', () => {
  beforeEach(() => {
    cardOrder.length = 0
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    const { getByRole } = render(<Coaching />)
    expect(getByRole('heading', { name: 'Coaching' })).toBeInTheDocument()
  })

  it('invokes useKinetixCoachingContextState for provider-backed coaching (Rules of Hooks: may run more than once)', () => {
    const spy = vi.mocked(coachingContextModule.useKinetixCoachingContextState)
    render(<Coaching />)
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('renders coaching cards in section order: primary, planning, insights', () => {
    render(<Coaching />)
    expect(cardOrder).toEqual([
      'KinetixCoachCard',
      'KinetixCoachExplanationCard',
      'KinetixRaceReadinessCard',
      'KinetixCoachAlertsCard',
      'KinetixWeeklyCoachReportCard',
      'KinetixTimelineCard',
      'KinetixGoalProbabilityCard',
      'KinetixGoalProgressCard',
      'KinetixRaceSimulationCard',
      'KinetixPeriodizationCard',
      'KinetixLoadControlCard',
      'KinetixTrainingPlanCard',
      'KinetixTrainingCalendarCard',
      'KinetixIntelligenceCard',
      'KinetixCoachMemoryCard',
    ])
  })

  it('CoachingStack runs under a single provider with shared state hook', () => {
    const spy = vi.mocked(coachingContextModule.useKinetixCoachingContextState)
    render(
      <KinetixCoachingContextProvider>
        <CoachingStack />
      </KinetixCoachingContextProvider>
    )
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1)
  })
})
