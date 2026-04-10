import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import History from './History'
import * as coachingContextModule from '../hooks/useKinetixCoachingContext'
import { useKinetixCoach } from '../hooks/useKinetixCoach'

const mockRun = {
  id: 1,
  date: '2026-04-01T10:00:00.000Z',
  distance: 5000,
  duration: 1500,
  averagePace: 300,
  targetKPS: 80,
  locations: [],
  splits: [],
  deleted: 0 as const,
}

vi.mock('./Coaching', () => ({
  HistoryCoachSummaryWithProvider: () => <div data-testid="history-coach-summary" />,
}))

vi.mock('../components/providers/useAuth', () => ({
  useAuth: () => ({
    profile: { id: 'test-user', age: 35, weight_kg: 70 },
  }),
}))

vi.mock('../hooks/useStableKinetixUserProfile', () => ({
  useStableKinetixUserProfile: () => ({ id: 'test-user', age: 35, weight_kg: 70 }),
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

vi.mock('../lib/kpsUtils', () => ({
  getPB: vi.fn(async () => null),
  isValidKPS: vi.fn(() => true),
  calculateAbsoluteKPS: vi.fn(() => 80),
  ensurePBInitialized: vi.fn(async () => undefined),
  calculateRelativeKPSSync: vi.fn(() => 80),
  isMeaningfulRunForKPS: vi.fn(() => true),
  filterRunsByRelativeKpsBounds: vi.fn(async (runs: unknown[]) => runs),
}))

vi.mock('../lib/authState', () => ({
  getProfileForRun: vi.fn(async () => ({ age: 35, weight_kg: 70 })),
}))

vi.mock('../lib/database', () => ({
  db: { runs: { get: vi.fn(async () => null) } },
  getRunsPage: vi.fn(async () => ({ items: [mockRun], total: 1 })),
  getRunsPageForDate: vi.fn(async () => ({ items: [], total: 0 })),
  getRunsInDateRange: vi.fn(async () => [mockRun]),
  getWeightsForDates: vi.fn(async () => new Map()),
  getAllVisibleRunsOrdered: vi.fn(async () => [mockRun]),
  RUN_VISIBLE: 0,
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

  it('renders compact coaching summary slot without mounting full coaching stack', async () => {
    const spy = vi.spyOn(coachingContextModule, 'useKinetixCoachingContext').mockReturnValue(fakeContext)

    render(<History />)

    expect(await screen.findByTestId('history-coach-summary')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    expect(screen.queryByText('Not enough data for race readiness yet.')).not.toBeInTheDocument()
    expect(screen.queryByText('No coaching alerts right now.')).not.toBeInTheDocument()
  })

  it('falls back to direct context hook when provider is absent', () => {
    const spy = vi
      .spyOn(coachingContextModule, 'useKinetixCoachingContext')
      .mockReturnValue(fakeContext)

    render(<FallbackConsumer />)

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
