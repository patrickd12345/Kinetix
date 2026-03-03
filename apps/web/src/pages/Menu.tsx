import { useCallback, useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import MaxKPSPaceDurationChart from '../components/MaxKPSPaceDurationChart'
import { db, RUN_VISIBLE, type RunRecord } from '../lib/database'
import { useSettingsStore } from '../store/settingsStore'

function MenuSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 border border-white/10 animate-pulse">
      <div className="h-4 w-48 rounded bg-gray-700/60 mb-3" />
      <div className="h-3 w-72 rounded bg-gray-800/60 mb-6" />
      <div className="h-[320px] rounded-xl bg-gray-900/50 mb-4" />
      <div className="h-20 rounded-xl bg-gray-900/40" />
    </div>
  )
}

export default function Menu() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const unitSystem = useSettingsStore((s) => s.unitSystem)

  const loadRuns = useCallback(async () => {
    if (typeof indexedDB === 'undefined') {
      setRuns([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const allRuns = await db.runs
        .orderBy('date')
        .reverse()
        .filter((run) => (run.deleted ?? 0) === RUN_VISIBLE)
        .toArray()
      setRuns(allRuns)
    } catch (error) {
      console.error('Error loading menu charts data:', error)
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRuns()

    const refresh = () => {
      void loadRuns()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('kinetix:runSaved', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('kinetix:runSaved', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [loadRuns])

  return (
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-6xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={26} className="text-violet-400" />
            Menu
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Informative performance charts powered by your run history.
          </p>
        </div>

        {loading ? (
          <MenuSkeleton />
        ) : (
          <MaxKPSPaceDurationChart runs={runs} unitSystem={unitSystem} />
        )}
      </div>
    </div>
  )
}
