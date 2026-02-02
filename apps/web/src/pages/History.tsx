import { useState, useEffect, useCallback } from 'react'
import { db, RunRecord } from '../lib/database'
import { formatPace } from '@kinetix/core'
import { useSettingsStore } from '../store/settingsStore'
import { useAICoach } from '../hooks/useAICoach'
import { Calendar, X } from 'lucide-react'
import RunHistoryItem from '../components/RunHistoryItem'

export default function History() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const { unitSystem } = useSettingsStore()
  const { isAnalyzing, aiResult, error, analyzeRun, clearResult } = useAICoach()

  const loadRuns = useCallback(async () => {
    try {
      const allRuns = await db.runs.orderBy('date').reverse().toArray()
      setRuns(allRuns)
    } catch (error) {
      console.error('Error loading runs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  const deleteRun = useCallback(
    async (id: number) => {
      if (confirm('Are you sure you want to delete this run?')) {
        try {
          await db.runs.delete(id)
          await loadRuns()
        } catch (error) {
          console.error('Error deleting run:', error)
        }
      }
    },
    [loadRuns]
  )

  const handleAnalyzeRun = useCallback(
    async (run: RunRecord) => {
      const distanceKm = run.distance / 1000
      const paceString = formatPace(run.averagePace, unitSystem)
      await analyzeRun(
        distanceKm,
        paceString,
        run.npi,
        run.targetNPI,
        run.duration,
        run.heartRate
      )
    },
    [analyzeRun, unitSystem]
  )

  if (loading) {
    return (
      <div className="pb-20">
        <div className="max-w-md mx-auto">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Run History</h1>
          {runs.length > 0 && (
            <span className="text-sm text-gray-400">{runs.length} runs</span>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Calendar className="mx-auto mb-4 text-gray-500" size={48} />
            <p className="text-gray-400 mb-2">No runs recorded yet</p>
            <p className="text-sm text-gray-500">Start a run to see it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Memoized list items to prevent re-renders when parent state (like AI modal) changes */}
            {runs.map((run) => (
              <RunHistoryItem
                key={run.id}
                run={run}
                unitSystem={unitSystem}
                onAnalyze={handleAnalyzeRun}
                onDelete={deleteRun}
                isAnalyzing={isAnalyzing}
              />
            ))}
          </div>
        )}

        {/* AI Coach Modal */}
        {(isAnalyzing || aiResult || error) && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="glass border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              {isAnalyzing ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                  <p className="text-cyan-400 font-mono text-sm">ANALYZING...</p>
                </div>
              ) : error ? (
                <div>
                  <h3 className="text-lg font-black text-red-400 mb-3">Error</h3>
                  <p className="text-sm text-gray-300 mb-4">{error}</p>
                  <button
                    onClick={clearResult}
                    className="w-full py-2.5 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-white text-sm font-bold border border-gray-700/50 transition-all"
                  >
                    Close
                  </button>
                </div>
              ) : aiResult ? (
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-black text-cyan-400">{aiResult.title}</h3>
                    <button
                      onClick={clearResult}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent my-3" />
                  <p className="text-sm text-gray-200 mb-5 leading-relaxed">{aiResult.insight}</p>
                  <button
                    onClick={clearResult}
                    className="w-full py-2.5 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-white text-sm font-bold border border-gray-700/50 transition-all"
                  >
                    Close
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
