import { useState, useEffect } from 'react'
import { RunRecord, getWeightsForDates } from '../lib/database'
import { getPBRun, calculateRelativeKPS } from '../lib/kpsUtils'
import { resolveProfileForRunWithWeightCache } from '../lib/authState'
import type { UserProfile } from '@kinetix/core'

/**
 * Hook to get the PB run and calculate relative KPS
 * The PB run always has KPS = 100, all others are scaled proportionally
 * Uses weight at run date for KPS so historical runs use correct weight.
 */
export function useBaselineKPS(_userProfile: UserProfile) {
  const [baselineRun, setBaselineRun] = useState<RunRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPBRun().then(setBaselineRun).finally(() => setLoading(false))
  }, [])

  const getRelativeKPSForRun = async (run: RunRecord): Promise<number> => {
    const weightByDate = await getWeightsForDates([run.date])
    const profileForRun = resolveProfileForRunWithWeightCache(weightByDate, run)
    return calculateRelativeKPS(run, profileForRun)
  }

  return { baselineRun, loading, getRelativeKPSForRun }
}
