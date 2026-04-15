import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DirectionalTodayCard } from './DirectionalTodayCard'

describe('DirectionalTodayCard', () => {
  const baseProps = {
    kps: { value: '88', label: 'Current KPS' },
    readiness: '92/100 (High)',
    fatigue: 'Low',
    lastRun: '5.00 km on 4/11/2026',
    suggestedTraining: 'Easy 5 km to build KPS with control',
    onStartRun: vi.fn(),
  }

  it('renders KPS as the hero metric with directional context and CTA', () => {
    const onStartRun = vi.fn()

    render(
      <DirectionalTodayCard
        {...baseProps}
        onStartRun={onStartRun}
        title="Your KPS signals readiness"
      />
    )

    expect(screen.getByRole('heading', { name: 'Your KPS signals readiness' })).toBeInTheDocument()
    expect(screen.getByLabelText('Current KPS: 88')).toBeInTheDocument()
    expect(screen.getByText('Suggested: Easy 5 km to build KPS with control')).toBeInTheDocument()
    expect(screen.getByText('Readiness')).toBeInTheDocument()
    expect(screen.getByText('92/100 (High)')).toBeInTheDocument()
    expect(screen.getByText('Fatigue')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('Last run')).toBeInTheDocument()
    expect(screen.getByText('5.00 km on 4/11/2026')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start suggested run' }))
    expect(onStartRun).toHaveBeenCalledTimes(1)
  })

  it('keeps the primary CTA disabled when actions are locked', () => {
    const onStartRun = vi.fn()

    render(<DirectionalTodayCard {...baseProps} onStartRun={onStartRun} disabled />)

    const startButton = screen.getByRole('button', { name: 'Start suggested run' })
    expect(startButton).toBeDisabled()
    fireEvent.click(startButton)
    expect(onStartRun).not.toHaveBeenCalled()
  })

  it('shows run progress state instead of changing behavior while running', () => {
    render(<DirectionalTodayCard {...baseProps} isRunning />)

    expect(screen.queryByRole('button', { name: 'Start suggested run' })).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Run in progress')
  })
})
