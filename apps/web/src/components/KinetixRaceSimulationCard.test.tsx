import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KinetixRaceSimulationCard } from './KinetixRaceSimulationCard'
import type { KinetixRaceSimulationViewModel } from '../hooks/useKinetixRaceSimulation'

function makeSimulation(overrides: Partial<KinetixRaceSimulationViewModel> = {}): KinetixRaceSimulationViewModel {
  return {
    selectedDistance: '10k',
    selectedDistanceLabel: '10K',
    isGoalDriven: true,
    projectedFinishSeconds: 2900,
    formattedFinishTime: '48:20',
    formattedPace: '4:50/km',
    fadeRisk: 'moderate',
    pacingRecommendation: 'Keep the first third controlled, then settle into even pacing.',
    splits: [
      {
        segmentStart: 0,
        segmentEnd: 2,
        paceSecondsPerKm: 290,
        label: '0.0-2.0 km',
        paceFormatted: '4:50/km',
        cumulativeSeconds: 580,
        cumulativeFormatted: '9:40',
      },
    ],
    caution: false,
    confidence: 0.7,
    confidenceLabel: 'Normal',
    insufficientData: false,
    ...overrides,
  }
}

describe('KinetixRaceSimulationCard', () => {
  it('shows goal-driven distance state', () => {
    render(
      <KinetixRaceSimulationCard
        loading={false}
        error={null}
        simulation={makeSimulation({ selectedDistanceLabel: 'Marathon', isGoalDriven: true })}
      />
    )

    expect(screen.getByText(/Current-fitness simulation · Distance: Marathon · Goal distance selected/i)).toBeInTheDocument()
  })

  it('shows fallback label when no goal drives simulation', () => {
    render(
      <KinetixRaceSimulationCard
        loading={false}
        error={null}
        simulation={makeSimulation({ isGoalDriven: false, selectedDistanceLabel: '10K' })}
      />
    )

    expect(screen.getByText(/Current-fitness simulation · Distance: 10K · Fallback distance selected/i)).toBeInTheDocument()
  })

  it('shows caution note for low-confidence result', () => {
    render(
      <KinetixRaceSimulationCard
        loading={false}
        error={null}
        simulation={makeSimulation({ caution: true, confidenceLabel: 'Conservative' })}
      />
    )

    expect(screen.getByText(/Confidence is low/i)).toBeInTheDocument()
  })

  it('renders pace summary with formatted value', () => {
    render(
      <KinetixRaceSimulationCard
        loading={false}
        error={null}
        simulation={makeSimulation({
          selectedDistance: '5k',
          selectedDistanceLabel: '5K',
          projectedFinishSeconds: 30 * 60 + 48,
          formattedFinishTime: '30:48',
          formattedPace: '6:10/km',
          fadeRisk: 'low',
          confidenceLabel: 'Normal',
        })}
      />
    )

    expect(screen.getByText('Projected finish (current-fitness pacing model)')).toBeInTheDocument()
    expect(screen.getByText('30:48')).toBeInTheDocument()
    expect(screen.getAllByText('Pace')[0]).toBeInTheDocument()
    expect(screen.getByText('6:10/km')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
  })

  it('renders formatted split values', () => {
    render(
      <KinetixRaceSimulationCard
        loading={false}
        error={null}
        simulation={makeSimulation()}
      />
    )

    expect(screen.getByText('0.0-2.0 km')).toBeInTheDocument()
    expect(screen.getAllByText('4:50/km')[0]).toBeInTheDocument()
    expect(screen.getByText('9:40')).toBeInTheDocument()
  })

  it('shows insufficient-data state', () => {
    render(
      <KinetixRaceSimulationCard
        loading={false}
        error={null}
        simulation={makeSimulation({
          insufficientData: true,
          projectedFinishSeconds: null,
          formattedFinishTime: '—',
          splits: [],
          fadeRisk: null,
          pacingRecommendation: null,
        })}
      />
    )

    expect(screen.getByText(/Not enough prediction or intelligence data/i)).toBeInTheDocument()
  })

  it('renders different fade risk labels for marathon and short-distance cases', () => {
    const { rerender } = render(
      <KinetixRaceSimulationCard
        loading={false}
        error={null}
        simulation={makeSimulation({ selectedDistanceLabel: 'Marathon', fadeRisk: 'high' })}
      />
    )

    expect(screen.getByText('High')).toBeInTheDocument()

    rerender(
      <KinetixRaceSimulationCard
        loading={false}
        error={null}
        simulation={makeSimulation({ selectedDistanceLabel: '5K', fadeRisk: 'low' })}
      />
    )

    expect(screen.getByText('Low')).toBeInTheDocument()
  })
})
