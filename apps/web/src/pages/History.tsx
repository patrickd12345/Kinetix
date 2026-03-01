import { useState, useEffect, useCallback, useRef } from 'react'
import { db, RunRecord, getRunsPage, getRunsPageForDate } from '../lib/database'
import { formatTime, formatDistance, formatPace } from '@kinetix/core'
import { useSettingsStore } from '../store/settingsStore'
import { useAICoach } from '../hooks/useAICoach'
import { calculateRelativeKPS, getPBRun, isValidKPS, calculateAbsoluteKPS, seedInitialPB } from '../lib/kpsUtils'
import { KPSTrendChart } from '../components/KPSTrendChart'
import { RunDetails } from '../components/RunDetails'
import { RunCalendar } from '../components/RunCalendar'
import { KPS_SHORT } from '../lib/branding'
import { Trash2, Calendar, MapPin, Clock, TrendingUp, Sparkles, X, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../components/providers/useAuth'
import { toKinetixUserProfile } from '../lib/kinetixProfile'

const DEFAULT_PAGE_SIZE = 20

export default function History() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [relativeKPSMap, setRelativeKPSMap] = useState<Map<number, number>>(new Map())
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set())
  const [invalidKPSCount, setInvalidKPSCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalRuns, setTotalRuns] = useState(0)
  const runRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollToDateRef = useRef<string | null>(null)
  const { unitSystem } = useSettingsStore()
  const { profile } = useAuth()
  const { isAnalyzing, aiResult, error, analyzeRun, clearResult } = useAICoach()
  const userProfile = profile ? toKinetixUserProfile(profile) : null
  const totalPages = Math.max(1, Math.ceil(totalRuns / pageSize))

  const loadRuns = useCallback(async (page: number) => {
    if (!userProfile) return
    try {
      setLoading(true)
      await seedInitialPB(userProfile)
      const { items, total } = await getRunsPage(page, pageSize)
      setRuns(items)
      setTotalRuns(total)

      const runsWithCalculatedKPS = items.map(r => ({
        run: r,
        calculatedKPS: calculateAbsoluteKPS(r, userProfile)
      }))
      const invalidKPS = runsWithCalculatedKPS.filter(({ calculatedKPS }) => !isValidKPS(calculatedKPS))
      setInvalidKPSCount(invalidKPS.length)

      void getPBRun().then((pbRun) => {
        if (pbRun) {
          console.log('✅ PB run:', {
            id: pbRun.id,
            date: pbRun.date,
            distance: pbRun.distance,
            duration: pbRun.duration
          })
        }
      })

      const kpsMap = new Map<number, number>()
      const batchSize = 50
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (run) => {
            if (run.id) {
              const relativeKPS = await calculateRelativeKPS(run, userProfile)
              kpsMap.set(run.id, relativeKPS)
            }
          })
        )
        setRelativeKPSMap(new Map(kpsMap))
      }
    } catch (error) {
      console.error('❌ Error loading runs:', error)
    } finally {
      setLoading(false)
    }
  }, [userProfile, pageSize])

  useEffect(() => {
    if (!userProfile) return
    void loadRuns(currentPage)
  }, [loadRuns, currentPage, userProfile])

  useEffect(() => {
    const dateStr = scrollToDateRef.current
    if (!dateStr || runs.length === 0) return
    const element = runRefs.current.get(dateStr)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-gray-900')
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-gray-900')
      }, 2000)
    }
    scrollToDateRef.current = null
  }, [runs])

  const deleteRun = async (id: number) => {
    if (confirm('Are you sure you want to delete this run?')) {
      try {
        await db.runs.delete(id)
        const newTotal = totalRuns - 1
        setTotalRuns(newTotal)
        setRuns((prev) => prev.filter((r) => r.id !== id))
        if (runs.length === 1 && currentPage > 1) {
          setCurrentPage((p) => Math.max(1, p - 1))
        }
      } catch (error) {
        console.error('Error deleting run:', error)
      }
    }
  }

  const toggleExpanded = useCallback((runId: number) => {
    setExpandedRuns(prev => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
  }, [])

  const handleAnalyzeRun = async (run: RunRecord) => {
    const distanceKm = run.distance / 1000
    const paceString = formatPace(run.averagePace, unitSystem)
    const relativeKPS = run.id ? (relativeKPSMap.get(run.id) ?? run.kps) : run.kps
    await analyzeRun(
      distanceKm,
      paceString,
      relativeKPS,
      run.targetKPS,
      run.duration,
      run.heartRate
    )
  }

  const handleDateSelect = useCallback(async (date: Date) => {
    const selectedDateStr = date.toISOString().split('T')[0]
    const runOnPage = runs.find(run => run.date.split('T')[0] === selectedDateStr)
    if (runOnPage) {
      const dateKey = runOnPage.date.split('T')[0]
      const element = runRefs.current.get(dateKey)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-gray-900')
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-gray-900')
        }, 2000)
      }
      return
    }
    const targetPage = await getRunsPageForDate(selectedDateStr, pageSize)
    if (targetPage !== currentPage) {
      scrollToDateRef.current = selectedDateStr
      setCurrentPage(targetPage)
    }
  }, [runs, pageSize, currentPage])

  if (!profile) {
    return (
      <div className="pb-20 lg:pb-4">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <div className="glass rounded-2xl border border-yellow-500/30 p-6 space-y-2">
            <h1 className="text-lg font-bold text-yellow-300">Loading profile...</h1>
            <p className="text-sm text-gray-300">
              Your platform profile is still loading. If this persists, refresh the page.
            </p>
          </div>
        </div>
      </div>
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
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Run History</h1>
          <div className="flex items-center gap-4">
            {totalRuns > 0 && (
              <span className="text-sm text-gray-400">
                {totalRuns} run{totalRuns !== 1 ? 's' : ''}
                {totalPages > 1 && (
                  <span className="ml-2 text-gray-500">
                    · Page {currentPage} of {totalPages}
                  </span>
                )}
              </span>
            )}
            {totalPages > 1 && (
              <nav className="flex items-center gap-1" aria-label="History pagination">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, i, arr) => (
                    <span key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && (
                        <span className="px-1 text-gray-500">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        disabled={loading}
                        className={`min-w-[2rem] py-1.5 px-2 rounded-lg text-sm font-medium transition-colors ${
                          p === currentPage
                            ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                            : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                        } disabled:opacity-50 disabled:pointer-events-none`}
                        aria-label={`Page ${p}`}
                        aria-current={p === currentPage ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || loading}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </nav>
            )}
          </div>
        </div>

        {runs.length === 0 && !loading ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Calendar className="mx-auto mb-4 text-gray-500" size={48} />
            <p className="text-gray-400 mb-2">No runs recorded yet</p>
            <p className="text-sm text-gray-500">Start a run to see it here</p>
          </div>
        ) : (
          <>
            {/* Warning for invalid KPS */}
            {invalidKPSCount > 0 && (
              <div className="mb-4 glass border border-yellow-500/30 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-400 mb-1">
                    {invalidKPSCount} run{invalidKPSCount > 1 ? 's' : ''} with invalid score values
                  </p>
                  <p className="text-xs text-gray-400">
                    Some runs have missing or invalid performance data. These runs may show score = 0.
                  </p>
                </div>
              </div>
            )}

            {/* Desktop: Multi-column layout */}
            <div className="lg:grid lg:grid-cols-3 lg:gap-6">
              {/* Left Column: Chart and Calendar */}
              <div className="lg:col-span-1 space-y-6">
                {/* KPS Trend Chart */}
                <div>
                  <KPSTrendChart runs={runs} relativeKPSMap={relativeKPSMap} unitSystem={unitSystem} />
                </div>

                {/* Calendar for quick navigation */}
                <div>
                  <RunCalendar runs={runs} onDateSelect={handleDateSelect} />
                </div>
              </div>

              {/* Right Column: Run List */}
              <div className="lg:col-span-2">
                {/* Virtualized Run List */}
                <div className="space-y-3 lg:max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500 scrollbar-track-gray-800">
              {runs.map((run) => {
                const relativeKPS = run.id ? (relativeKPSMap.get(run.id) ?? run.kps) : run.kps
                const isExpanded = run.id ? expandedRuns.has(run.id) : false
                const dateKey = run.date.split('T')[0]
                
                return (
                  <div 
                    key={run.id} 
                    ref={(el) => {
                      if (el && run.id) {
                        runRefs.current.set(dateKey, el)
                      }
                    }}
                    className="glass rounded-xl p-4 hover:border-cyan-500/30 transition-all"
                  >
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
                        <div className="text-2xl font-black text-cyan-400">
                          {Number.isFinite(relativeKPS) ? Math.round(relativeKPS) : '–'}
                        </div>
                        <div className="text-xs text-gray-500 uppercase">{KPS_SHORT}</div>
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
                    {run.notes && !isExpanded && (
                      <div className="mt-2 text-xs text-gray-400 italic">{run.notes}</div>
                    )}
                    {run.id && (
                      <>
                        {!isExpanded ? (
                          <button
                            onClick={() => toggleExpanded(run.id!)}
                            className="w-full mt-2 text-xs text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1 transition-colors"
                          >
                            <TrendingUp size={14} />
                            <span>Show Details</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => toggleExpanded(run.id!)}
                              className="w-full mt-2 text-xs text-gray-400 hover:text-gray-300 flex items-center justify-center gap-1 transition-colors mb-2"
                            >
                              <TrendingUp size={14} />
                              <span>Hide Details</span>
                            </button>
                            <RunDetails run={run} relativeKPS={relativeKPS} unitSystem={unitSystem} />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
                </div>
              </div>
            </div>
          </>
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
                      aria-label="Close"
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
