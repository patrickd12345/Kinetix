import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import Settings from '../pages/Settings'
import * as plannedRacesLib from '../lib/plannedRaces'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/database', () => ({
  getDb: vi.fn(() => ({
    weightHistory: { count: vi.fn().mockResolvedValue(0) },
    runs: { toArray: vi.fn().mockResolvedValue([]) },
  })),
  getWeightHistoryCount: vi.fn().mockResolvedValue(0),
  getWeightsForDates: vi.fn().mockResolvedValue([]),
}))


import { useAuth } from '../components/providers/useAuth'

vi.mock('../components/providers/useAuth', () => ({
  useAuth: vi.fn(() => ({
    profile: { id: 'test-profile-123' },
    user: { id: 'test-user-123' },
    signOut: vi.fn(),
  })),
  useRequireAuth: vi.fn(),
}))


vi.mock('../lib/plannedRaces', () => ({
  listPlannedRacesForProfile: vi.fn(),
  createPlannedRace: vi.fn(),
  updatePlannedRace: vi.fn(),
  deletePlannedRace: vi.fn(),
}))

describe('Planned Races Settings Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      profile: { id: 'test-profile-123' },
      user: { id: 'test-user-123' },
      signOut: vi.fn(),
    } as any)
  })

  it('Settings page renders planned races section and can add a race', async () => {
    const mockList = vi.mocked(plannedRacesLib.listPlannedRacesForProfile)
    const mockCreate = vi.mocked(plannedRacesLib.createPlannedRace)

    mockList.mockResolvedValueOnce([]) // Initial load

    render(<MemoryRouter><Settings /></MemoryRouter>)

    // Verify section heading
    expect(await screen.findByText('Planned Races')).toBeInTheDocument()

    // Open add form
    const addButton = await screen.findByRole('button', { name: 'Add Race' })
    fireEvent.click(addButton)

    // Fill form
    const nameInput = screen.getByText('Race Name').nextElementSibling as HTMLInputElement
    const dateInput = screen.getByText('Date').nextElementSibling as HTMLInputElement
    const distanceInput = screen.getByText('Distance (km)').nextElementSibling as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: 'Save' })

    fireEvent.change(nameInput, { target: { value: 'My First 10K' } })
    fireEvent.change(dateInput, { target: { value: '2026-10-10' } })
    fireEvent.change(distanceInput, { target: { value: '10' } })

    // Submit form
    mockList.mockResolvedValueOnce([
      {
        id: 'new-race-1',
        profile_id: 'test-profile-123',
        race_name: 'My First 10K',
        race_date: '2026-10-10',
        distance_meters: 10000,
        goal_time_seconds: null,
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
    ])

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('test-profile-123', {
        race_name: 'My First 10K',
        race_date: '2026-10-10',
        distance_meters: 10000,
        goal_time_seconds: null,
        notes: null,
      })
    })

    // Expect the new race to appear in the list
    expect(await screen.findByText('My First 10K')).toBeInTheDocument()
  })
})
