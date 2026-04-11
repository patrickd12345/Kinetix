import { useState, useEffect, useCallback, useRef } from 'react'
import {
  db,
  RunRecord,
  getRunsPage,
  getRunsPageForDate,
  getRunsInDateRange,
  getWeightsForDates,
  getAllVisibleRunsOrdered,
  hideRun,
  RUN_VISIBLE,
} from '../lib/database'
import { formatTime, formatDistance, formatPace } from '@kinetix/core'
import { useSettingsStore } from '../store/settingsStore'
import { useAICoach } from '../hooks/useAICoach'
import {
  getPB,
  ensurePBInitialized,
  calculateRelativeKPSSync,
  isMeaningfulRunForKPS,
  filterRunsByRelativeKpsBounds,
} from '../lib/kpsUtils'
import { resolveProfileForRunWithWeightCache } from '../lib/authState'
import {
  buildHistoryKpsTierKey,
  clearHistoryKpsDerivedCache,
  computeHistoryKpsDerived,
} from '../lib/historyKpsDerivedCache'
import { KPSTrendChart } from '../components/KPSTrendChart'
import { RunDetails } from '../components/RunDetails'
import { RunCalendar } from '../components/RunCalendar'
import { KPS_SHORT } from '../lib/branding'
import {
  Trash2,
  Calendar,
  MapPin,
  Clock,
  TrendingUp,
  Sparkles,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Scale,
  Filter,
  Medal,
} from 'lucide-react'
import {
  defaultRunHistoryFilters,
  hasActiveRunHistoryFilters,
  runMatchesHistoryFilters,
  draftToRunHistoryFilters,
  applyDistanceUnitToFilters,
  emptyRunHistoryFilterDraft,
  runDisplayTitle,
  hasKpsBoundsInFilters,
  moveRunIdToFront,
  type RunHistoryFilters,
  type RunHistoryFilterDraft,
} from '../lib/historyFilters'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/providers/useAuth'
import { useStableKinetixUserProfile } from '../hooks/useStableKinetixUserProfile'
import type { KpsMedal } from '../lib/kpsMedals'
import { WITHINGS_WEIGHTS_SYNCED_EVENT } from '../lib/withings'
import { HistoryCoachSummaryWithProvider } from '../components/HistoryCoachSummary'

const DEFAULT_PAGE_SIZE = 20
const CHART_LIMIT = 200
const DEFAULT_CHART_DAYS = 90
const CHART_ZOOM_FACTOR = 1.5
const CHART_MIN_DAYS = 7
const CHART_MAX_DAYS = 730
const KG_TO_LBS = 2.20462

function formatWeight(kg: number, unit: 'kg' | 'lbs'): string {
  if (unit === 'lbs') return `${(kg * KG_TO_LBS).toFixed(1)} lbs`
  return `${kg.toFixed(1)} kg`
}

export default function History() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  /** Avoid full-page flash on every refetch; only block UI until first successful load. */
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false)
  const [relativeKPSMap, setRelativeKPSMap] = useState<Map<number, number>>(new Map())
  const [medalByRunId, setMedalByRunId] = useState<Map<number, KpsMedal>>(() => new Map())
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set())
  const [invalidKPSCount, setInvalidKPSCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalRuns, setTotalRuns] = useState(0)
  const [pbRunId, setPbRunId] = useState<number | null>(null)
  const [pbRunDate, setPbRunDate] = useState<string | null>(null)
  const [chartStartDate, setChartStartDate] = useState<string | null>(null)
  const [chartEndDate, setChartEndDate] = useState<string | null>(null)
  const [chartRuns, setChartRuns] = useState<RunRecord[]>([])
  const [chartKPSMap, setChartKPSMap] = useState<Map<number, number>>(new Map())
  const [chartLoading, setChartLoading] = useState(false)
  const runRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollToDateRef = useRef<string | null>(null)
  /** Only the latest history load may clear the full-page loading gate (avoids stuck UI when an older async is cancelled). */
  const historyLoadGenerationRef = useRef(0)
  const hasCompletedInitialLoadRef = useRef(false)
  const unitSystem = useSettingsStore((s) => s.unitSystem)
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const weightSource = useSettingsStore((s) => s.weightSource)
  const physioMode = useSettingsStore((s) => s.physioMode)
  const lastWithingsWeightKg = useSettingsStore((s) => s.lastWithingsWeightKg)
  const [weightByRunDate, setWeightByRunDate] = useState<Map<string, number>>(() => new Map())
  const { profile } = useAuth()
  const { isAnalyzing, aiResult, error, analyzeRun, clearResult } = useAICoach()
  const userProfile = useStableKinetixUserProfile(profile)
  useEffect(() => {
    if (!profile) {
      setHasCompletedInitialLoad(false)
      clearHistoryKpsDerivedCache()
    }
  }, [profile])

  useEffect(() => {
    hasCompletedInitialLoadRef.current = hasCompletedInitialLoad
  }, [hasCompletedInitialLoad])

  const [appliedFilters, setAppliedFilters] = useState<RunHistoryFilters>(() => defaultRunHistoryFilters())
  const [filterDraft, setFilterDraft] = useState<RunHistoryFilterDraft>(() => emptyRunHistoryFilterDraft())
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [clientFilteredRuns, setClientFilteredRuns] = useState<RunRecord[] | null>(null)
  const [listRefreshKey, setListRefreshKey] = useState(0)
  const bumpListRefresh = useCallback(() => setListRefreshKey((k) => k + 1), [])
  const filterActive = hasActiveRunHistoryFilters(appliedFilters)
  /** Client-side filters show the full match list in one scroll; unpaginated mode uses DB pages. */
  const totalPages = filterActive
    ? 1
    : Math.max(1, Math.ceil(totalRuns / pageSize))

  useEffect(() => {
    if (!userProfile) {
      setLoading(false)
      return
    }
    const generation = ++historyLoadGenerationRef.current
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        await ensurePBInitialized(userProfile)
        const fa = hasActiveRunHistoryFilters(appliedFilters)
        const fResolved = applyDistanceUnitToFilters(
          appliedFilters,
          unitSystem === 'metric' ? 'metric' : 'imperial'
        )

        let items: RunRecord[]
        let total: number
        let medalSourceRuns: RunRecord[]

        if (!fa) {
          const page = await getRunsPage(currentPage, pageSize)
          if (cancelled) return
          const all = await getAllVisibleRunsOrdered()
          if (cancelled) return
          items = page.items
          medalSourceRuns = all
          total = page.total
          setClientFilteredRuns(null)
          setRuns(items)
          setTotalRuns(total)
        } else {
          const all = await getAllVisibleRunsOrdered()
          if (cancelled) return
          let filtered = all.filter((r) => runMatchesHistoryFilters(r, fResolved))
          if (hasKpsBoundsInFilters(fResolved)) {
            filtered = await filterRunsByRelativeKpsBounds(filtered, fResolved.kpsMin, fResolved.kpsMax)
            const pbOrder = await getPB()
            if (pbOrder?.runId != null) {
              filtered = moveRunIdToFront(filtered, pbOrder.runId)
            }
          }
          if (cancelled) return
          setClientFilteredRuns(filtered)
          total = filtered.length
          // Show every matching run in one list so scrolling reaches all cards (pagination was easy to miss).
          items = filtered
          medalSourceRuns = all
          setRuns(items)
          setTotalRuns(total)
        }

        const pb = await getPB()
        let pbRun = pb ? (await db.runs.get(pb.runId)) ?? null : null
        if (pbRun && (pbRun.deleted ?? 0) !== RUN_VISIBLE) pbRun = null
        setPbRunId(pbRun && pb != null ? pb.runId : null)
        setPbRunDate(pbRun?.date ?? null)

        const itemIds = new Set(items.map((run) => run.id).filter((id): id is number => id != null))
        const weightByRunDateLocal = await getWeightsForDates(medalSourceRuns.map((r) => r.date))
        if (cancelled) return
        const tierKey = buildHistoryKpsTierKey({
          pb,
          weightSource,
          lastWithingsWeightKg,
          physioMode,
          profileAge: userProfile.age,
          profileWeightKg: userProfile.weightKg,
        })
        const derived = computeHistoryKpsDerived({
          tierKey,
          userId: profile?.id ?? null,
          medalSourceRuns,
          itemIds,
          weightByRunDate: weightByRunDateLocal,
          pb,
          pbRun,
        })
        if (cancelled) return
        setInvalidKPSCount(derived.invalidKPS)
        setRelativeKPSMap(derived.kpsMap)
        setMedalByRunId(derived.medalByRunId)
        if (import.meta.env.DEV) {
          console.debug('[History] runs loaded', {
            profileId: profile?.id ?? null,
            totalRuns: total,
            pageItems: items.length,
            filterActive: fa,
          })
        }
      } catch (error) {
        console.error('[History] failed to load runs', {
          profileId: profile?.id ?? null,
          error,
        })
      } finally {
        const isLatestGeneration = generation === historyLoadGenerationRef.current
        if (isLatestGeneration) {
          setLoading(false)
          setHasCompletedInitialLoad(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    userProfile,
    currentPage,
    pageSize,
    appliedFilters,
    listRefreshKey,
    unitSystem,
    lastWithingsWeightKg,
    weightSource,
    physioMode,
    profile?.id,
  ])

  // After Withings startup sync (or manual refresh), re-resolve weight-at-date for the current list.
  useEffect(() => {
    if (runs.length === 0 || !userProfile) return
    let cancelled = false
    void (async () => {
      const map = await getWeightsForDates(runs.map((r) => r.date))
      if (!cancelled) setWeightByRunDate(map)
    })()
    return () => {
      cancelled = true
    }
  }, [runs, lastWithingsWeightKg, userProfile])

  // Set initial chart range to last DEFAULT_CHART_DAYS when we have list runs and no range yet
  useEffect(() => {
    if (runs.length === 0) return
    const newest = runs[0]?.date
    if (!newest) return
    if (chartEndDate == null) {
      const end = new Date(newest)
      const start = new Date(end.getTime() - DEFAULT_CHART_DAYS * 24 * 60 * 60 * 1000)
      setChartStartDate(start.toISOString())
      setChartEndDate(end.toISOString())
      return
    }
    // Extend chart end date if the list now has a newer run (e.g. after Strava sync or delayed refetch)
    if (newest > chartEndDate) {
      setChartEndDate(newest)
    }
  }, [runs, chartEndDate])

  const loadChartRuns = useCallback(async () => {
    if (!userProfile || !chartStartDate || !chartEndDate) return
    try {
      setChartLoading(true)
      const items = await getRunsInDateRange(chartStartDate, chartEndDate, CHART_LIMIT)
      const meaningfulRuns = items.filter((r) => isMeaningfulRunForKPS(r))
      setChartRuns(meaningfulRuns)
      const pb = await getPB()
      let pbRun = pb ? (await db.runs.get(pb.runId)) ?? null : null
      if (pbRun && (pbRun.deleted ?? 0) !== RUN_VISIBLE) pbRun = null
      const weightMap = await getWeightsForDates(meaningfulRuns.map((r) => r.date))
      const kpsMap = new Map<number, number>()
      for (const run of meaningfulRuns) {
        if (run.id) {
          const resolved = resolveProfileForRunWithWeightCache(weightMap, run)
          kpsMap.set(run.id, calculateRelativeKPSSync(run, resolved, pb ?? null, pbRun ?? null))
        }
      }
      setChartKPSMap(kpsMap)
    } catch (err) {
      console.error('Chart load error:', err)
    } finally {
      setChartLoading(false)
    }
  }, [userProfile, chartStartDate, chartEndDate])

  useEffect(() => {
    if (!chartStartDate || !chartEndDate || !userProfile) return
    void loadChartRuns()
  }, [loadChartRuns, chartStartDate, chartEndDate, userProfile])

  // Refetch when app/tab becomes visible or when a run is saved (handles race when user navigates before save completes)
  useEffect(() => {
    if (!userProfile) return
    const refresh = () => {
      const willBumpList = hasCompletedInitialLoadRef.current
      if (willBumpList) {
        bumpListRefresh()
      }
      if (chartStartDate && chartEndDate) void loadChartRuns()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const onRunSaved = () => refresh()
    const onWithingsSynced = () => refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('kinetix:runSaved', onRunSaved)
    window.addEventListener(WITHINGS_WEIGHTS_SYNCED_EVENT, onWithingsSynced)
    const delayedRefresh = window.setTimeout(refresh, 5000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('kinetix:runSaved', onRunSaved)
      window.removeEventListener(WITHINGS_WEIGHTS_SYNCED_EVENT, onWithingsSynced)
      clearTimeout(delayedRefresh)
    }
  }, [bumpListRefresh, loadChartRuns, userProfile, chartStartDate, chartEndDate])

  const handleChartZoomOut = useCallback(() => {
    if (!chartStartDate || !chartEndDate) return
    const startMs = new Date(chartStartDate).getTime()
    const endMs = new Date(chartEndDate).getTime()
    const spanMs = endMs - startMs
    const spanDays = spanMs / (24 * 60 * 60 * 1000)
    const newSpanDays = Math.min(CHART_MAX_DAYS, spanDays * CHART_ZOOM_FACTOR)
    const centerMs = (startMs + endMs) / 2
    const halfMs = (newSpanDays / 2) * 24 * 60 * 60 * 1000
    setChartStartDate(new Date(centerMs - halfMs).toISOString())
    setChartEndDate(new Date(centerMs + halfMs).toISOString())
  }, [chartStartDate, chartEndDate])

  const handleChartZoomIn = useCallback(() => {
    if (!chartStartDate || !chartEndDate) return
    const startMs = new Date(chartStartDate).getTime()
    const endMs = new Date(chartEndDate).getTime()
    const spanMs = endMs - startMs
    const spanDays = spanMs / (24 * 60 * 60 * 1000)
    const newSpanDays = Math.max(CHART_MIN_DAYS, spanDays / CHART_ZOOM_FACTOR)
    const centerMs = (startMs + endMs) / 2
    const halfMs = (newSpanDays / 2) * 24 * 60 * 60 * 1000
    setChartStartDate(new Date(centerMs - halfMs).toISOString())
    setChartEndDate(new Date(centerMs + halfMs).toISOString())
  }, [chartStartDate, chartEndDate])

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
        await hideRun(id)
        setExpandedRuns((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        if (runs.length === 1 && currentPage > 1) {
          setCurrentPage((p) => Math.max(1, p - 1))
        }
        bumpListRefresh()
      } catch (error) {
        console.error('Error deleting run:', error)
      }
    }
  }

  const handleApplyFilters = useCallback(() => {
    const paceUnit = unitSystem === 'metric' ? 'min/km' : 'min/mi'
    setAppliedFilters(draftToRunHistoryFilters(filterDraft, paceUnit))
    setCurrentPage(1)
  }, [filterDraft, unitSystem])

  const handleClearFilters = useCallback(() => {
    setFilterDraft(emptyRunHistoryFilterDraft())
    setAppliedFilters(defaultRunHistoryFilters())
    setCurrentPage(1)
  }, [])

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
    const relativeKPS = run.id ? (relativeKPSMap.get(run.id) ?? 0) : 0
    await analyzeRun(
      distanceKm,
      paceString,
      relativeKPS,
      run.targetKPS,
      run.duration,
      run.heartRate
    )
  }

  const handleDateSelect = useCallback(
    async (date: Date) => {
      const selectedDateStr = date.toISOString().split('T')[0]
      const runOnPage = runs.find((run) => run.date.split('T')[0] === selectedDateStr)
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
      if (filterActive && clientFilteredRuns && clientFilteredRuns.length > 0) {
        // Filtered history is one continuous list; no page to switch. Calendar already tried runs above.
        return
      }
      const targetPage = await getRunsPageForDate(selectedDateStr, pageSize)
      if (targetPage !== currentPage) {
        scrollToDateRef.current = selectedDateStr
        setCurrentPage(targetPage)
      }
    },
    [runs, pageSize, currentPage, filterActive, clientFilteredRuns]
  )

  const handleScrollToReferenceRun = useCallback((dateKey: string) => {
    handleDateSelect(new Date(dateKey + 'T12:00:00'))
    const halfDays = Math.floor(DEFAULT_CHART_DAYS / 2) * 24 * 60 * 60 * 1000
    const center = new Date(dateKey + 'T12:00:00').getTime()
    setChartStartDate(new Date(center - halfDays).toISOString())
    setChartEndDate(new Date(center + halfDays).toISOString())
  }, [handleDateSelect])

  const paceUnitShort = unitSystem === 'metric' ? 'min/km' : 'min/mi'
  const distUnitShort = unitSystem === 'metric' ? 'km' : 'mi'

  if (!profile) {
    return (
      <div className="pb-20 lg:pb-4">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <div className="glass rounded-2xl border border-yellow-500/30 p-6 space-y-2">
            <h1 className="text-lg font-bold text-yellow-300">Loading profile...</h1>
            <p className="text-sm text-slate-700 dark:text-gray-300">
              Your platform profile is still loading. If this persists, refresh the page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="pb-20 lg:pb-4">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <div className="glass rounded-2xl border border-yellow-500/30 p-6 space-y-2">
            <h1 className="text-lg font-bold text-yellow-300">Preparing run history…</h1>
            <p className="text-sm text-slate-700 dark:text-gray-300">
              Resolving runner profile fields for {KPS_SHORT}. If this persists, refresh the page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading && !hasCompletedInitialLoad) {
    return (
      <div className="pb-20">
        <div className="max-w-md mx-auto">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-slate-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Run History</h1>
          <div className="flex items-center gap-4">
            {totalRuns > 0 && (
              <span className="text-sm text-slate-600 dark:text-gray-400">
                {totalRuns} run{totalRuns !== 1 ? 's' : ''}
                {totalPages > 1 && (
                  <span className="ml-2 text-slate-500 dark:text-gray-500">
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
                  className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, i, arr) => (
                    <span key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && (
                        <span className="px-1 text-slate-500 dark:text-gray-500">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        disabled={loading}
                        className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                          p === currentPage
                            ? 'border border-cyan-600/50 bg-cyan-500/20 text-cyan-800 dark:bg-cyan-500/30 dark:text-cyan-400 dark:border-cyan-500/50'
                            : 'border border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
                        } disabled:pointer-events-none disabled:opacity-50`}
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
                  className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </nav>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200/90 bg-white/90 dark:border-white/10 dark:bg-white/[0.03]">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={filtersOpen}
            aria-controls="history-filters-panel"
            id="history-filters-toggle"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Filter size={16} className="text-cyan-600 dark:text-cyan-400" aria-hidden />
              Filter activities
              {filterActive && (
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-normal text-cyan-800 dark:text-cyan-300">
                  active
                </span>
              )}
            </span>
            <span className="text-xs text-slate-500 dark:text-gray-500">{filtersOpen ? 'Hide' : 'Show'}</span>
          </button>
          <div
            id="history-filters-panel"
            role="region"
            aria-labelledby="history-filters-toggle"
            hidden={!filtersOpen}
            className="space-y-3 border-t border-slate-200/90 px-4 pb-4 pt-3 dark:border-white/10"
          >
              <p className="text-xs text-slate-500 dark:text-gray-500">
                Pace values are in {paceUnitShort} (decimal minutes). Use the preset to hide unrealistically fast activities (e.g. car trips).{' '}
                {KPS_SHORT} bounds use the same relative score as the list (vs your personal-best reference). With
                these bounds applied, your reference run ({KPS_SHORT} 100) is listed first.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">Name contains</span>
                  <input
                    type="search"
                    value={filterDraft.nameContains}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, nameContains: e.target.value }))}
                    placeholder="e.g. Morning, Tempo"
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-gray-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">
                    Fastest pace to show ({paceUnitShort})
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={filterDraft.paceFastestMin}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, paceFastestMin: e.target.value }))}
                    placeholder="e.g. 3"
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-gray-600"
                  />
                  <span className="mt-0.5 block text-[11px] text-slate-600 dark:text-gray-600">
                    Hides activities faster than this (cars, bad GPS).
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">
                    Slowest pace to show ({paceUnitShort})
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={filterDraft.paceSlowestMin}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, paceSlowestMin: e.target.value }))}
                    placeholder="e.g. 15"
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-gray-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">Min duration (minutes)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    value={filterDraft.durationMinMin}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, durationMinMin: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-black/40 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">Max duration (minutes)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    value={filterDraft.durationMaxMin}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, durationMaxMin: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-black/40 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">Min distance ({distUnitShort})</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={filterDraft.distanceMin}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, distanceMin: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-black/40 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">Max distance ({distUnitShort})</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={filterDraft.distanceMax}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, distanceMax: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-black/40 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">Min {KPS_SHORT} (relative)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={filterDraft.kpsMin}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, kpsMin: e.target.value }))}
                    placeholder="e.g. 50"
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-gray-600"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">Max {KPS_SHORT} (relative)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={filterDraft.kpsMax}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, kpsMax: e.target.value }))}
                    placeholder="e.g. 100"
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-gray-600"
                  />
                </label>
                <label className="sm:col-span-2 block">
                  <span className="mb-1 block text-xs text-slate-600 dark:text-gray-400">Source (exact)</span>
                  <input
                    type="text"
                    value={filterDraft.sourceEquals}
                    onChange={(e) => setFilterDraft((d) => ({ ...d, sourceEquals: e.target.value }))}
                    placeholder="e.g. strava, garmin"
                    className="w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-gray-600"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="rounded-lg bg-cyan-600/80 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-700 dark:text-gray-300 hover:bg-white/10"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilterDraft((d) => ({
                      ...d,
                      paceFastestMin: unitSystem === 'metric' ? '3' : '5',
                    }))
                  }
                  className="text-xs text-cyan-400/90 hover:text-cyan-300"
                >
                  Preset: exclude drives (~3 min/km or ~5 min/mi)
                </button>
              </div>
            </div>
        </div>

        <>
            {invalidKPSCount > 0 && runs.length > 0 && (
              <div className="mb-4 glass border border-yellow-500/30 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-400 mb-1">
                    {invalidKPSCount} run{invalidKPSCount > 1 ? 's' : ''} with invalid score values
                  </p>
                  <p className="text-xs text-slate-600 dark:text-gray-400">
                    Some runs have missing or invalid performance data. These runs may show score = 0.
                  </p>
                </div>
              </div>
            )}

            {/* Desktop: Multi-column layout */}
            <div className="lg:grid lg:grid-cols-3 lg:gap-6">
              {/* Left Column: Chart and Calendar */}
              <div className="lg:col-span-1 space-y-6">
                <HistoryCoachSummaryWithProvider />
                {/* KPS Trend Chart (date-range zoom: scroll to zoom in/out over history) */}
                <div className="relative">
                  {chartLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-gray-900/60">
                      <span className="text-sm text-slate-600 dark:text-gray-400">Loading chart…</span>
                    </div>
                  )}
                  <KPSTrendChart
                    runs={chartRuns}
                    relativeKPSMap={chartKPSMap}
                    unitSystem={unitSystem}
                    pbRunId={pbRunId}
                    referenceRunDateKey={pbRunDate?.split('T')[0] ?? null}
                    referenceRunDateFormatted={pbRunDate ? new Date(pbRunDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null}
                    onWheelZoomIn={handleChartZoomIn}
                    onWheelZoomOut={handleChartZoomOut}
                    onScrollToReferenceRun={handleScrollToReferenceRun}
                  />
                </div>

                {/* Calendar for quick navigation */}
                <div>
                  <RunCalendar
                    runs={filterActive && clientFilteredRuns ? clientFilteredRuns : runs}
                    onDateSelect={handleDateSelect}
                  />
                </div>
              </div>

              {/* Right Column: Run List */}
              <div className="lg:col-span-2">
                {runs.length === 0 && !loading ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <Calendar className="mx-auto mb-4 text-slate-500 dark:text-gray-500" size={48} />
                    {filterActive ? (
                      <>
                        <p className="mb-2 text-slate-600 dark:text-gray-400">No activities match your filters.</p>
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
                        >
                          Clear filters
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mb-2 text-slate-600 dark:text-gray-400">No runs in this browser yet</p>
                        <p className="text-sm text-slate-500 dark:text-gray-500 mb-3">
                          Runs are stored locally (IndexedDB). Record a run from the Run tab, or import from Strava or Garmin in Settings.
                        </p>
                        <Link to="/settings" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">
                          Open Settings
                        </Link>
                      </>
                    )}
                  </div>
                ) : runs.length === 0 && loading ? (
                  <div className="glass rounded-2xl p-8 text-center text-slate-600 dark:text-gray-400">
                    Loading runs…
                  </div>
                ) : (
                <div className="space-y-3 lg:max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500 scrollbar-track-gray-800">
              {runs.map((run) => {
                const relativeKPS = run.id ? (relativeKPSMap.get(run.id) ?? 0) : 0
                const medal = run.id ? medalByRunId.get(run.id) : undefined
                const isExpanded = run.id ? expandedRuns.has(run.id) : false
                const dateKey = run.date.split('T')[0]
                const displayWeightKg = weightByRunDate.get(run.date) ?? run.weightKg
                const title = runDisplayTitle(run)

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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar size={14} className="text-slate-600 dark:text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {new Date(run.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="mb-1.5 truncate text-sm font-medium text-slate-800 dark:text-gray-100" title={title}>
                          {title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-gray-400">
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
                          <div className="flex items-center gap-1">
                            <Scale size={12} />
                            {displayWeightKg != null && displayWeightKg > 0
                              ? formatWeight(displayWeightKg, weightUnit)
                              : '–'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {medal && (
                            <span
                              className="inline-flex"
                              aria-label={
                                medal === 'gold'
                                  ? 'Gold medal: top relative score tier in this list'
                                  : medal === 'silver'
                                    ? 'Silver medal: second relative score tier in this list'
                                    : 'Bronze medal: third relative score tier in this list'
                              }
                            >
                              <Medal
                                className={`flex-shrink-0 ${medal === 'gold' ? 'text-amber-400' : medal === 'silver' ? 'text-slate-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]' : 'text-amber-700'}`}
                                size={26}
                                strokeWidth={1.75}
                                aria-hidden
                              />
                            </span>
                          )}
                          <div className="text-2xl font-black text-cyan-400">
                            {isMeaningfulRunForKPS(run) && Number.isFinite(relativeKPS)
                              ? Math.round(relativeKPS)
                              : '–'}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-500 uppercase">{KPS_SHORT}</div>
                        <div className="flex gap-2 mt-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleAnalyzeRun(run)}
                            className="text-cyan-400 hover:text-cyan-300 transition-colors"
                            disabled={isAnalyzing}
                            aria-label={`Analyze ${runDisplayTitle(run)} with AI coach`}
                            title="Analyze with AI Coach"
                          >
                            <Sparkles size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => run.id && deleteRun(run.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            aria-label={`Delete ${runDisplayTitle(run)}`}
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </div>
                      </div>
                    </div>
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
                              className="w-full mt-2 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-700 dark:hover:text-slate-700 dark:text-gray-300 flex items-center justify-center gap-1 transition-colors mb-2"
                            >
                              <TrendingUp size={14} />
                              <span>Hide Details</span>
                            </button>
                            <RunDetails
                              run={run}
                              relativeKPS={relativeKPS}
                              unitSystem={unitSystem}
                              displayWeightKg={displayWeightKg}
                              isReferenceRun={pbRunId != null && run.id === pbRunId}
                              runnerAgeYears={userProfile?.age ?? undefined}
                            />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
                </div>
                )}
              </div>
            </div>
        </>

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
                  <p className="text-sm text-slate-700 dark:text-gray-300 mb-4">{error}</p>
                  <button
                    onClick={clearResult}
                    className="w-full rounded-xl border border-slate-300/80 bg-slate-100 py-2.5 text-sm font-bold text-slate-900 transition-all hover:bg-slate-200 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-white dark:hover:bg-gray-800"
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
                      className="text-slate-600 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent my-3" />
                  <p className="text-sm text-slate-800 dark:text-gray-200 mb-5 leading-relaxed">{aiResult.insight}</p>
                  <button
                    onClick={clearResult}
                    className="w-full rounded-xl border border-slate-300/80 bg-slate-100 py-2.5 text-sm font-bold text-slate-900 transition-all hover:bg-slate-200 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-white dark:hover:bg-gray-800"
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
