import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, AlertCircle } from 'lucide-react'
import MaxKPSPaceDurationChart from '../components/MaxKPSPaceDurationChart'
import Kps100CurveChart from '../components/Kps100CurveChart'
import { db, getWeightsForDates, RUN_VISIBLE } from '../lib/database'
import { WITHINGS_WEIGHTS_SYNCED_EVENT } from '../lib/withings'
import { useSettingsStore } from '../store/settingsStore'
import { buildMaxKPSPaceDurationPoints, generateKps100Curve } from '../lib/maxKpsPaceChart'
import type { MaxKPSPaceDurationPoint } from '../lib/maxKpsPaceChart'
import {
  createGetProfileForRunWithWeightCache,
  getActivePlatformProfile,
} from '../lib/authState'
import { useAuth } from '../components/providers/useAuth'
import { useStableKinetixUserProfile } from '../hooks/useStableKinetixUserProfile'
import type { UserProfile } from '@kinetix/core'
import {
  ensurePBInitialized,
  getPB,
  getPBRun,
  calculateAbsoluteKPS,
} from '../lib/kpsUtils'

function MenuSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 border border-white/10 animate-pulse" data-testid="charts-skeleton">
      <div className="h-4 w-48 rounded bg-gray-700/60 mb-3" />
      <div className="h-3 w-72 rounded bg-gray-800/60 mb-6" />
      <div className="h-[320px] rounded-xl bg-gray-900/50 mb-4" />
      <div className="h-20 rounded-xl bg-gray-900/40" />
    </div>
  )
}

class ChartErrorBoundary extends Component<
  { children: ReactNode; onRetry?: () => void },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Chart failed to render' }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Charts] Chart render error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass rounded-2xl p-8 border border-amber-500/30 text-center" data-testid="charts-error">
          <AlertCircle size={32} className="mx-auto mb-3 text-amber-400" />
          <p className="text-lg font-semibold text-slate-200 mb-2">Chart failed to load</p>
          <p className="text-sm text-slate-400 mb-4">{this.state.message}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, message: '' })
              this.props.onRetry?.()
            }}
            className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/30"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Menu() {
  const [points, setPoints] = useState<MaxKPSPaceDurationPoint[]>([])
  const [pbAbsoluteKps, setPbAbsoluteKps] = useState<number | null>(null)
  const [pbProfileSnapshot, setPbProfileSnapshot] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pbs' | 'curve'>('pbs')
  const unitSystem = useSettingsStore((s) => s.unitSystem)
  const lastWithingsWeightKg = useSettingsStore((s) => s.lastWithingsWeightKg)
  const { profile } = useAuth()
  const userProfile = useStableKinetixUserProfile(profile)

  const curvePoints = useMemo(() => {
    if (!pbProfileSnapshot || pbAbsoluteKps == null || pbAbsoluteKps <= 0)
      return []
    return generateKps100Curve(
      pbAbsoluteKps,
      pbProfileSnapshot,
      unitSystem ?? 'metric'
    )
  }, [pbAbsoluteKps, pbProfileSnapshot, unitSystem])

  const LOAD_TIMEOUT_MS = 60_000
  const loadInProgressRef = useRef(false)

  const loadRuns = useCallback(async () => {
    if (typeof indexedDB === 'undefined') {
      setPoints([])
      setPbAbsoluteKps(null)
      setPbProfileSnapshot(null)
      setLoading(false)
      return
    }
    if (loadInProgressRef.current) return
    loadInProgressRef.current = true
    setLoading(true)
    try {
      if (!userProfile || !getActivePlatformProfile()) {
        setPoints([])
        setPbAbsoluteKps(null)
        setPbProfileSnapshot(null)
        return
      }
      const load = async () => {
        await ensurePBInitialized(userProfile)
        const allRuns = await db.runs
          .orderBy('date')
          .reverse()
          .filter((run) => (run.deleted ?? 0) === RUN_VISIBLE)
          .toArray()
        const CHART_RUN_LIMIT = 2000
        const runsForChart = allRuns.slice(0, CHART_RUN_LIMIT)
        const runDates = runsForChart.map((r) => r.date)
        const weightByDate = await getWeightsForDates(runDates)
        const getProfileForRun = createGetProfileForRunWithWeightCache(weightByDate)
        const pts = await buildMaxKPSPaceDurationPoints(
          runsForChart,
          unitSystem ?? 'metric',
          getProfileForRun
        )
        const pb = await getPB()
        const pbRun = await getPBRun()
        let pbAbs: number | null = null
        let snapshot: UserProfile | null = null
        if (pb && pbRun && pb.profileSnapshot) {
          pbAbs = calculateAbsoluteKPS(pbRun, pb.profileSnapshot)
          console.log('[DEBUG PB AFTER DELETE]', {
            date: pbRun.date,
            distance: pbRun.distance,
            duration: pbRun.duration,
            averagePace: pbRun.averagePace,
            absoluteKPS: pbAbs
          })
          if (!Number.isFinite(pbAbs) || pbAbs <= 0) pbAbs = null
          else snapshot = pb.profileSnapshot
        }
        setPbAbsoluteKps(pbAbs)
        setPbProfileSnapshot(snapshot)
        return pts
      }
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Charts load timeout')), LOAD_TIMEOUT_MS)
      )
      const pts = await Promise.race([load(), timeout])
      setPoints(pts ?? [])
    } catch (error) {
      console.error('Error loading menu charts data:', error)
      setPoints([])
      setPbAbsoluteKps(null)
      setPbProfileSnapshot(null)
    } finally {
      loadInProgressRef.current = false
      setLoading(false)
    }
  }, [unitSystem, userProfile, lastWithingsWeightKg])

  useEffect(() => {
    void loadRuns()

    let visibilityTimeout: ReturnType<typeof setTimeout> | null = null
    const refresh = () => void loadRuns()
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (visibilityTimeout) clearTimeout(visibilityTimeout)
      visibilityTimeout = setTimeout(refresh, 300)
    }

    window.addEventListener('kinetix:runSaved', refresh)
    window.addEventListener(WITHINGS_WEIGHTS_SYNCED_EVENT, refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (visibilityTimeout) clearTimeout(visibilityTimeout)
      window.removeEventListener('kinetix:runSaved', refresh)
      window.removeEventListener(WITHINGS_WEIGHTS_SYNCED_EVENT, refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [loadRuns])

  return (
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-6xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={26} className="text-violet-400" />
            Charts
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Informative performance charts powered by your run history.
          </p>
        </div>

        {loading ? (
          <MenuSkeleton />
        ) : (
          <>
            <div
              className="flex gap-1 p-1 rounded-xl bg-black/30 border border-violet-500/20 w-fit mb-4"
              role="tablist"
              aria-label="Chart type"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'pbs'}
                onClick={() => setActiveTab('pbs')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'pbs'
                    ? 'bg-violet-500/30 text-cyan-300'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                PBs by duration
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'curve'}
                onClick={() => setActiveTab('curve')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'curve'
                    ? 'bg-violet-500/30 text-cyan-300'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Pace to hit KPS 100
              </button>
            </div>
            <ChartErrorBoundary onRetry={() => void loadRuns()}>
              {activeTab === 'pbs' && (
                <MaxKPSPaceDurationChart
                  points={points}
                  unitSystem={unitSystem ?? 'metric'}
                />
              )}
              {activeTab === 'curve' && (
                <Kps100CurveChart
                  points={curvePoints}
                  unitSystem={unitSystem ?? 'metric'}
                />
              )}
            </ChartErrorBoundary>
          </>
        )}
      </div>
    </div>
  )
}
