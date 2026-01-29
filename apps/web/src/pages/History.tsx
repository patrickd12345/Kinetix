import { useState, useEffect } from 'react'
import { db, RunRecord } from '../lib/database'
import { formatTime, formatDistance, formatPace } from '@kinetix/core'
import { useSettingsStore } from '../store/settingsStore'
import { useAICoach } from '../hooks/useAICoach'
import { Trash2, Calendar, MapPin, Clock, TrendingUp, Sparkles, X } from 'lucide-react'

const PAGE_SIZE = 10

export default function History() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const { unitSystem } = useSettingsStore()
  const { isAnalyzing, aiResult, error, analyzeRun, clearResult } = useAICoach()

  const loadRuns = async (isInitial = false) => {
    try {
      let newRuns: RunRecord[]
      if (isInitial) {
        newRuns = await db.runs.orderBy('date').reverse().limit(PAGE_SIZE).toArray()
      } else {
        const lastRun = runs[runs.length - 1]
        if (!lastRun) return
        newRuns = await db.runs
          .where('date')
          .below(lastRun.date)
          .reverse()
          .limit(PAGE_SIZE)
          .toArray()
      }

      if (newRuns.length < PAGE_SIZE) {
        setHasMore(false)
      }

      if (isInitial) {
        setRuns(newRuns)
      } else {
        setRuns((prev) => [...prev, ...newRuns])
      }
    } catch (error) {
      console.error('Error loading runs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRuns(true)
  }, [])

  const deleteRun = async (id: number) => {
    if (confirm('Are you sure you want to delete this run?')) {
      try {
        await db.runs.delete(id)
        setRuns((prev) => prev.filter((r) => r.id !== id))
      } catch (error) {
        console.error('Error deleting run:', error)
      }
    }
  }

  const handleAnalyzeRun = async (run: RunRecord) => {
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
  }

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

        {runs.length === 0 && !loading ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Calendar className="mx-auto mb-4 text-gray-500" size={48} />
            <p className="text-gray-400 mb-2">No runs recorded yet</p>
            <p className="text-sm text-gray-500">Start a run to see it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <div key={run.id} className="glass rounded-xl p-4 hover:border-cyan-500/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-sm font-semibold text-white">
                        {new Date(run.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} />
                        {formatDistance(run.distance, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatTime(run.duration)}
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        {formatPace(run.averagePace, unitSystem)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-black text-cyan-400">{Math.round(run.npi)}</div>
                    <div className="text-xs text-gray-500 uppercase">NPI</div>
                    <div className="flex gap-2 mt-2 justify-end">
                      <button
                        onClick={() => handleAnalyzeRun(run)}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                        disabled={isAnalyzing}
                        title="Analyze with AI Coach"
                      >
                        <Sparkles size={14} />
                      </button>
                      <button
                        onClick={() => run.id && deleteRun(run.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                {run.notes && (
                  <div className="mt-2 text-xs text-gray-400 italic">{run.notes}</div>
                )}
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => loadRuns(false)}
                className="w-full py-3 glass rounded-xl text-cyan-400 font-bold hover:bg-cyan-500/10 transition-colors"
              >
                Load More
              </button>
            )}
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
