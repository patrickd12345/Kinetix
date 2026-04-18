import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useBaselineKPS } from './useBaselineKPS'
import * as dbMock from '../lib/database'
import * as authMock from '../lib/authState'
import * as kpsUtilsMock from '../lib/kpsUtils'
import type { UserProfile } from '@kinetix/core'

vi.mock('../lib/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/database')>()
  return {
    ...actual,
    getWeightsForDates: vi.fn(),
  }
})

vi.mock('../lib/authState', () => ({
  resolveProfileForRunWithWeightCache: vi.fn(),
}))

vi.mock('../lib/kpsUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/kpsUtils')>()
  return {
    ...actual,
    getPBRun: vi.fn(),
    calculateRelativeKPS: vi.fn(),
  }
})

describe('useBaselineKPS', () => {
  const mockProfile: UserProfile = { age: 30, weightKg: 70 }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(kpsUtilsMock.getPBRun).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses getWeightsForDates for batch fetching weights instead of N+1 lookups', async () => {
    const run = { date: '2023-01-01', id: 1, distance: 1000, duration: 600, averagePace: 600 } as any

    vi.mocked(dbMock.getWeightsForDates).mockResolvedValue(new Map([['2023-01-01', 70]]))
    vi.mocked(authMock.resolveProfileForRunWithWeightCache).mockReturnValue(mockProfile)
    vi.mocked(kpsUtilsMock.calculateRelativeKPS).mockResolvedValue(120)

    const { result } = renderHook(() => useBaselineKPS(mockProfile))

    // Wait for the initial loading to finish
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Call the function
    const kps = await result.current.getRelativeKPSForRun(run)

    expect(kps).toBe(120)

    // Assert that the batch loading method was used correctly
    expect(dbMock.getWeightsForDates).toHaveBeenCalledTimes(1)
    expect(dbMock.getWeightsForDates).toHaveBeenCalledWith(['2023-01-01'])

    // Assert that the cache resolution was called
    expect(authMock.resolveProfileForRunWithWeightCache).toHaveBeenCalledTimes(1)
    expect(authMock.resolveProfileForRunWithWeightCache).toHaveBeenCalledWith(
      expect.any(Map),
      run
    )
  })

  it('calculates properly if no weight found', async () => {
    const run = { date: '2023-01-02', id: 2, distance: 2000, duration: 1200, averagePace: 600 } as any

    vi.mocked(dbMock.getWeightsForDates).mockResolvedValue(new Map())
    vi.mocked(authMock.resolveProfileForRunWithWeightCache).mockReturnValue(mockProfile)
    vi.mocked(kpsUtilsMock.calculateRelativeKPS).mockResolvedValue(95)

    const { result } = renderHook(() => useBaselineKPS(mockProfile))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const kps = await result.current.getRelativeKPSForRun(run)

    expect(kps).toBe(95)
    expect(dbMock.getWeightsForDates).toHaveBeenCalledTimes(1)
    expect(dbMock.getWeightsForDates).toHaveBeenCalledWith(['2023-01-02'])
  })
})
