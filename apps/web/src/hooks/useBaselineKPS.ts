import { useState, useEffect } from 'react'
import { RunRecord } from '../lib/database'
import { getPBRun, calculateRelativeKPS } from '../lib/kpsUtils'
import { UserProfile } from '@kinetix/core'

/**
 * Hook to get the PB run and calculate relative KPS
 * The PB run always has KPS = 100, all others are scaled proportionally
 * PB is a stored fact, not discovered by scanning
 */
export function useBaselineKPS(userProfile: UserProfile) {
  const [baselineRun, setBaselineRun] = useState<RunRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPBRun().then(setBaselineRun).finally(() => setLoading(false))
  }, [])

  const getRelativeKPSForRun = async (run: RunRecord): Promise<number> => {
    return calculateRelativeKPS(run, userProfile)
  }

  return { baselineRun, loading, getRelativeKPSForRun }
}
