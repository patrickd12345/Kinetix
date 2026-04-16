import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KinetixCoachExplanationCard } from './KinetixCoachExplanationCard'

describe('KinetixCoachExplanationCard', () => {
  it('renders insufficient-data state deterministically', () => {
    render(
      <KinetixCoachExplanationCard
        loading={false}
        error={null}
        explanation={null}
        insufficientData
      />
    )

    expect(screen.getByText(/Not enough data to explain the coaching decision yet/i)).toBeInTheDocument()
  })
})
