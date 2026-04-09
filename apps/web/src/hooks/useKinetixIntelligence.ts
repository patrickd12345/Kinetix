import { useEffect, useState } from 'react'
import { getAllVisibleRunsOrdered, db, type RunRecord, RUN_VISIBLE } from '../lib/database'
import { getActivePlatformProfile, getProfileForRun } from '../lib/authState'
import { calculateRelativeKPSSync, getPB, isMeaningfulRunForKPS } from '../lib/kpsUtils'
import { computeIntelligence } from '../lib/intelligence/intelligenceEngine'
import { buildIntelligenceHealthSignals } from '../lib/intelligence/healthMetricSignals'
import type { IntelligenceResult, KpsSample } from '../lib/intelligence/types'

function toKpsSample(run: RunRecord, kps: number): KpsSample {
  return {
    date: run.date,
    kps,
  }
}

export function useKinetixIntelligence() {
  const [loading, setLoading] = useState(true)
  const [samples, setSamples] = useState<KpsSample[]>([])
  const [result, setResult] = useState<IntelligenceResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const runs = (await getAllVisibleRunsOrdered())
          .filter((run) => isMeaningfulRunForKPS(run))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        const pb = await getPB()
        let pbRun = pb ? (await db.runs.get(pb.runId)) ?? null : null
        if (pbRun && (pbRun.deleted ?? 0) !== RUN_VISIBLE) pbRun = null

        const nextSamples: KpsSample[] = []
        for (const run of runs) {
          const profileForRun = await getProfileForRun(run)
          const relativeKps = calculateRelativeKPSSync(run, profileForRun, pb, pbRun)
          if (!Number.isFinite(relativeKps) || relativeKps <= 0) continue
          nextSamples.push(toKpsSample(run, relativeKps))
        }
        const activeProfile = getActivePlatformProfile()
        if (activeProfile?.id) await buildIntelligenceHealthSignals(activeProfile.id)

        if (cancelled) return
        setSamples(nextSamples)
        setResult(nextSamples.length > 0 ? computeIntelligence(nextSamples) : null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to compute intelligence')
        setResult(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    loading,
    error,
    samples,
    result,
  }
}
