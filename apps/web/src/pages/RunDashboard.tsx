import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useRunStore } from '../store/runStore'
import { useSettingsStore } from '../store/settingsStore'
import { formatDistance, formatPace, timeToAchieveKPS, distanceToAchieveKPS } from '@kinetix/core'
import { useLocationTracking } from '../hooks/useLocationTracking'
import { useAICoach } from '../hooks/useAICoach'
import { ensurePBInitialized, getRelativeKPS, getPB, getPBRun, calculateAbsoluteKPS, isMeaningfulRunForKPS, isValidKPS, calculateRelativeKPSSync } from '../lib/kpsUtils'
import { getRunsPage, getWeightsForDates } from '../lib/database'
import { resolveProfileForRunWithWeightCache } from '../lib/authState'
import { useAuth } from '../components/providers/useAuth'
import { useStableKinetixUserProfile } from '../hooks/useStableKinetixUserProfile'
import { RunDashboardHeader, RunGaugePanel, RunStatsPanel, RunControlsPanel, RunDesktopSummary } from './run-dashboard/RunDashboardPanels'
import { AICoachModal, BeatTargetModal } from './run-dashboard/RunDashboardModals'
import type { BeatTargetOption } from './run-dashboard/types'
import { computeIntelligence } from '../lib/intelligence/intelligenceEngine'
import { KPS_SHORT } from '../lib/branding'
import {
  appendLiveKpsSample,
  getLiveKpsDisplayState,
  getSmoothedLiveKps,
  type LiveKpsDisplayState,
} from '../lib/liveKpsDisplay'
import { DirectionalTodayCard } from '../components/directional/DirectionalTodayCard'
import {
  type DirectionalHomeSummary,
  computeDirectionalStreakDays,
  getDirectionalCoachMessage,
  getDirectionalSuggestedTraining,
  titleCase,
} from './run-dashboard/directionalHomeSummary'

export default function RunDashboard() {
  const {
    isRunning,
    isPaused,
    hasGPSFix,
    distance,
    duration,
    averagePace,
    heartRate,
    progress,
    timeToBeat,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    reset,
  } = useRunStore()
  
  const { targetKPS, unitSystem, physioMode, beatPBPercent, beatRecentsCount } = useSettingsStore()
  const { profile } = useAuth()
  const userProfile = useStableKinetixUserProfile(profile)
  const [relativeKPS, setRelativeKPS] = useState(0)
  const [liveKpsDisplay, setLiveKpsDisplay] = useState<LiveKpsDisplayState>({
    text: '0',
    label: `Live ${KPS_SHORT}`,
    numericValue: 0,
    isCalibrating: false,
  })
  const [homeSummary, setHomeSummary] = useState<DirectionalHomeSummary>({
    loading: true,
    lastRun: null,
    runCount7d: 0,
    distance7d: 0,
    streakDays: 0,
    latestKps: null,
    intelligence: null,
    error: null,
  })
  useLocationTracking()

  // Rolling pace tracking
  const rollingPaceSamplesRef = useRef<Array<{ durationSeconds: number; distanceMeters: number }>>([])
  const [rollingPace, setRollingPace] = useState(0)

  useEffect(() => {
    if (!isRunning || duration === 0) {
      rollingPaceSamplesRef.current = []
      setRollingPace(0)
      return
    }

    const samples = rollingPaceSamplesRef.current
    const newSample = { durationSeconds: duration, distanceMeters: distance }

    // Only add a new sample if it has advanced by at least 2 seconds to reduce array churn
    if (samples.length === 0 || duration - samples[samples.length - 1].durationSeconds >= 2) {
      samples.push(newSample)
    }

    // Keep only the last ~120 seconds of samples
    const ROLLING_WINDOW_SECONDS = 120
    while (samples.length > 0 && duration - samples[0].durationSeconds > ROLLING_WINDOW_SECONDS) {
      samples.shift()
    }

    // Calculate rolling pace if we have a valid window
    if (samples.length >= 2) {
      const oldest = samples[0]
      const newest = samples[samples.length - 1]

      const deltaDistance = newest.distanceMeters - oldest.distanceMeters
      const deltaDuration = newest.durationSeconds - oldest.durationSeconds

      if (deltaDistance > 0 && deltaDuration > 0) {
        setRollingPace(deltaDuration / (deltaDistance / 1000))
      }
    }
  }, [duration, distance, isRunning])

  useEffect(() => {
    if (!userProfile || !(distance > 0 && duration > 0)) {
      setRelativeKPS(0)
      return
    }

    // For live KPS, we want to score the rolling effort, projecting the rolling pace over the distance run so far
    const effectivePace = rollingPace > 0 ? rollingPace : averagePace
    const effectiveDuration = effectivePace > 0 && distance > 0 ? (distance / 1000) * effectivePace : duration

    const tempRun: import('../lib/database').RunRecord = {
      date: new Date().toISOString(),
      distance,
      duration: effectiveDuration,
      averagePace: effectivePace,
      targetKPS,
      locations: [],
      splits: [],
    }
    ensurePBInitialized(userProfile)
      .then(() => getRelativeKPS(tempRun, userProfile))
      .then(setRelativeKPS)
      .catch(() => setRelativeKPS(0))
  }, [distance, duration, averagePace, rollingPace, targetKPS, userProfile])

  const liveKpsSamplesRef = useRef<Array<{ atMs: number; value: number }>>([])

  useEffect(() => {
    if (!isRunning) {
      liveKpsSamplesRef.current = []
      setLiveKpsDisplay({
        text: '0',
        label: `Live ${KPS_SHORT}`,
        numericValue: 0,
        isCalibrating: false,
      })
      return
    }

    liveKpsSamplesRef.current = appendLiveKpsSample(liveKpsSamplesRef.current, {
      atMs: Math.round(duration * 1000),
      value: relativeKPS,
    })

    const smoothedRelativeKps = getSmoothedLiveKps(liveKpsSamplesRef.current)
    const nextDisplay = getLiveKpsDisplayState({
      isRunning,
      durationSeconds: duration,
      distanceKm: distance / 1000,
      paceSecPerKm: rollingPace > 0 ? rollingPace : averagePace,
      sampleCount: rollingPaceSamplesRef.current.length,
      smoothedRelativeKps,
    })

    setLiveKpsDisplay({
      ...nextDisplay,
      label: nextDisplay.isCalibrating ? nextDisplay.label : `Live ${KPS_SHORT}`,
    })
  }, [duration, distance, averagePace, rollingPace, isRunning, relativeKPS])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!userProfile) {
        setHomeSummary((prev) => ({ ...prev, loading: false, error: null }))
        return
      }

      setHomeSummary((prev) => ({ ...prev, loading: true, error: null }))
      try {
        await ensurePBInitialized(userProfile)
        const { items } = await getRunsPage(1, 30)
        const now = Date.now()
        const sevenDaysAgo = now - 7 * 86_400_000
        const meaningful = items.filter(isMeaningfulRunForKPS)

        // Bulk load weights, PB, and PB run once to avoid N+1 queries in the loop.
        const [weightMap, pb, pbRun] = await Promise.all([
          getWeightsForDates(meaningful.map((r) => r.date)),
          getPB(),
          getPBRun(),
        ])

        const samples = []
        for (const run of [...meaningful].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
          const profileForRun = resolveProfileForRunWithWeightCache(weightMap, run)
          const kps = calculateRelativeKPSSync(run, profileForRun, pb, pbRun)
          if (Number.isFinite(kps) && kps > 0) samples.push({ date: run.date, kps })
        }
        const lastRun = items[0] ?? null
        const runs7d = items.filter((run) => new Date(run.date).getTime() >= sevenDaysAgo)
        const nextSummary: DirectionalHomeSummary = {
          loading: false,
          lastRun,
          runCount7d: runs7d.length,
          distance7d: runs7d.reduce((sum, run) => sum + run.distance, 0),
          streakDays: computeDirectionalStreakDays(items),
          latestKps: samples.length > 0 ? samples[samples.length - 1].kps : null,
          intelligence: samples.length > 0 ? computeIntelligence(samples) : null,
          error: null,
        }
        if (!cancelled) setHomeSummary(nextSummary)
      } catch (err) {
        if (!cancelled) {
          setHomeSummary({
            loading: false,
            lastRun: null,
            runCount7d: 0,
            distance7d: 0,
            streakDays: 0,
            latestKps: null,
            intelligence: null,
            error: err instanceof Error ? err.message : 'Unable to load today summary',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userProfile])

  const displayKPS = useMemo(
    () => (isRunning ? liveKpsDisplay.numericValue ?? 0 : relativeKPS),
    [isRunning, liveKpsDisplay.numericValue, relativeKPS]
  )

  const { isAnalyzing, aiResult, error, analyzeRun, clearResult } = useAICoach()
  const [showAICoach, setShowAICoach] = useState(false)
  const [showBeatPBModal, setShowBeatPBModal] = useState(false)
  const [beatPBOptions, setBeatPBOptions] = useState<BeatTargetOption[] | null>(null)
  const [beatPBError, setBeatPBError] = useState<string | null>(null)
  const [showBeatRecentsModal, setShowBeatRecentsModal] = useState(false)
  const [beatRecentsOptions, setBeatRecentsOptions] = useState<BeatTargetOption[] | null>(null)
  const [beatRecentsError, setBeatRecentsError] = useState<string | null>(null)
  const [isActionLocked, setIsActionLocked] = useState(false)
  const actionLockRef = useRef(false)

  const openBeatPB = useCallback(async () => {
    setBeatPBError(null)
    setBeatPBOptions(null)
    setShowBeatPBModal(true)
    if (!userProfile) {
      setBeatPBError('Profile required.')
      return
    }
    const pb = await getPB()
    const pbRun = await getPBRun()
    if (!pb || !pbRun) {
      setBeatPBError('No PB set yet. Complete a run and set a PB from History first.')
      return
    }
    const pbAbsoluteKPS = calculateAbsoluteKPS(pbRun, pb.profileSnapshot)
    if (pbAbsoluteKPS <= 0) {
      setBeatPBError('PB run has invalid KPS.')
      return
    }
    const targetAbsoluteKPS = pbAbsoluteKPS * (1 + beatPBPercent / 100)
    const distanceOptions: Array<{ label: string; distanceKm: number }> = [
      { label: 'Same as PB', distanceKm: pbRun.distance / 1000 },
      { label: '5 km', distanceKm: 5 },
      { label: '10 km', distanceKm: 10 },
      { label: 'Half marathon', distanceKm: 21.0975 },
    ]
    const timeOptions: Array<{ label: string; timeSeconds: number }> = [
      { label: '15 min', timeSeconds: 15 * 60 },
      { label: '20 min', timeSeconds: 20 * 60 },
      { label: '30 min', timeSeconds: 30 * 60 },
    ]
    const options: BeatTargetOption[] = [
      ...timeOptions.map(({ label, timeSeconds }) => ({
        type: 'time' as const,
        label,
        timeSeconds,
        distanceKm: distanceToAchieveKPS(targetAbsoluteKPS, timeSeconds, userProfile),
      })),
      ...distanceOptions.map(({ label, distanceKm }) => ({
        type: 'distance' as const,
        label,
        distanceKm,
        timeSeconds: timeToAchieveKPS(targetAbsoluteKPS, distanceKm, userProfile),
      })),
    ]
    setBeatPBOptions(options)
  }, [userProfile, beatPBPercent])

  const openBeatRecents = useCallback(async () => {
    setBeatRecentsError(null)
    setBeatRecentsOptions(null)
    setShowBeatRecentsModal(true)
    if (!userProfile) {
      setBeatRecentsError('Profile required.')
      return
    }
    const { items: recentRuns } = await getRunsPage(1, beatRecentsCount)
    const meaningful = recentRuns.filter(isMeaningfulRunForKPS)
    if (meaningful.length === 0) {
      setBeatRecentsError(`No meaningful runs in the last ${beatRecentsCount}. Complete at least one run first.`)
      return
    }

    const weightMap = await getWeightsForDates(meaningful.map((r) => r.date))
    let bestKPS = 0
    for (const run of meaningful) {
      const profileForRun = resolveProfileForRunWithWeightCache(weightMap, run)
      const kps = calculateAbsoluteKPS(run, profileForRun)
      if (isValidKPS(kps) && kps > bestKPS) bestKPS = kps
    }
    if (bestKPS <= 0) {
      setBeatRecentsError('Could not compute KPS for recent runs.')
      return
    }
    const targetAbsoluteKPS = bestKPS * (1 + beatPBPercent / 100)
    const referenceRun = meaningful[0]
    const referenceDistanceKm = referenceRun.distance / 1000
    const distanceOptions: Array<{ label: string; distanceKm: number }> = [
      { label: 'Same as recent', distanceKm: referenceDistanceKm },
      { label: '5 km', distanceKm: 5 },
      { label: '10 km', distanceKm: 10 },
      { label: 'Half marathon', distanceKm: 21.0975 },
    ]
    const timeOptions: Array<{ label: string; timeSeconds: number }> = [
      { label: '15 min', timeSeconds: 15 * 60 },
      { label: '20 min', timeSeconds: 20 * 60 },
      { label: '30 min', timeSeconds: 30 * 60 },
    ]
    const options: BeatTargetOption[] = [
      ...timeOptions.map(({ label, timeSeconds }) => ({
        type: 'time' as const,
        label,
        timeSeconds,
        distanceKm: distanceToAchieveKPS(targetAbsoluteKPS, timeSeconds, userProfile),
      })),
      ...distanceOptions.map(({ label, distanceKm }) => ({
        type: 'distance' as const,
        label,
        distanceKm,
        timeSeconds: timeToAchieveKPS(targetAbsoluteKPS, distanceKm, userProfile),
      })),
    ]
    setBeatRecentsOptions(options)
  }, [userProfile, beatPBPercent, beatRecentsCount])

  useEffect(() => {
    if (!isRunning && distance > 0 && duration > 0) {
      setShowAICoach(true)
    } else {
      setShowAICoach(false)
    }
  }, [isRunning, distance, duration])

  const runGuardedAction = async (action: () => void | Promise<void>) => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    setIsActionLocked(true)
    try {
      await action()
    } finally {
      window.setTimeout(() => {
        actionLockRef.current = false
        setIsActionLocked(false)
      }, 350)
    }
  }

  if (!profile) {
    return (
      <div className="pb-20 lg:pb-4">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <div className="glass rounded-2xl border border-yellow-600/35 p-6 space-y-2 dark:border-yellow-500/30">
            <h1 className="text-lg font-bold text-yellow-800 dark:text-yellow-300">Loading profile...</h1>
            <p className="text-sm text-slate-600 dark:text-gray-300">
              Your platform profile is still loading. If this persists, refresh the page.
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  const handleAIAnalysis = async () => {
    const distanceKm = distance / 1000
    const paceString = formatPace(averagePace, unitSystem)
    await analyzeRun(
      distanceKm,
      paceString,
      displayKPS,
      targetKPS,
      duration,
      heartRate > 70 ? heartRate : undefined
    )
  }

  const handleStartRun = () => {
    void runGuardedAction(() => startRun())
  }

  const handlePauseRun = () => {
    void runGuardedAction(() => pauseRun())
  }

  const handleResumeRun = () => {
    void runGuardedAction(() => resumeRun())
  }

  const handleStopRun = () => {
    void runGuardedAction(() => stopRun())
  }

  const handleResetRun = () => {
    void runGuardedAction(() => {
      const hasProgress = distance > 0 || duration > 0
      if (isRunning) {
        if (!window.confirm('Discard this run? Progress will not be saved.')) return
        reset()
        return
      }
      if (!hasProgress) return
      if (!window.confirm('Clear session metrics?')) return
      reset()
    })
  }

  const handleOpenBeatPB = () => {
    void runGuardedAction(() => openBeatPB())
  }

  const handleOpenBeatRecents = () => {
    void runGuardedAction(() => openBeatRecents())
  }

  const handleGuardedAIAnalysis = () => {
    void runGuardedAction(() => handleAIAnalysis())
  }

  const closeBeatPBModal = () => {
    setShowBeatPBModal(false)
    setBeatPBOptions(null)
    setBeatPBError(null)
  }

  const closeBeatRecentsModal = () => {
    setShowBeatRecentsModal(false)
    setBeatRecentsOptions(null)
    setBeatRecentsError(null)
  }

  const readinessText = homeSummary.intelligence
    ? `${homeSummary.intelligence.readiness.score}/100 (${titleCase(homeSummary.intelligence.readiness.status)})`
    : homeSummary.loading
      ? 'Loading'
      : 'Needs baseline'
  const fatigueText = homeSummary.intelligence
    ? titleCase(homeSummary.intelligence.fatigue.level)
    : homeSummary.loading
      ? 'Loading'
      : 'Unknown'
  const lastRunText = homeSummary.lastRun
    ? `${formatDistance(homeSummary.lastRun.distance, unitSystem)} ${unitSystem === 'metric' ? 'km' : 'mi'} on ${new Date(homeSummary.lastRun.date).toLocaleDateString('en-US')}`
    : 'No runs yet'
  const trendText = homeSummary.intelligence
    ? `${homeSummary.intelligence.trend >= 0 ? '+' : ''}${homeSummary.intelligence.trend.toFixed(1)}%`
    : 'No trend yet'
  const heroKpsValue = isRunning
    ? liveKpsDisplay.text
    : displayKPS > 0
      ? Math.floor(displayKPS).toString()
      : homeSummary.latestKps != null
        ? Math.round(homeSummary.latestKps).toString()
        : KPS_SHORT
  const heroKpsLabel = isRunning
    ? liveKpsDisplay.label
    : displayKPS > 0
      ? `Live ${KPS_SHORT}`
      : homeSummary.latestKps != null
        ? `Current ${KPS_SHORT}`
        : 'Baseline pending'
  const suggested = getDirectionalSuggestedTraining(homeSummary)
  const coachMessage = getDirectionalCoachMessage(homeSummary)
  const todayTitle = homeSummary.intelligence?.readiness.status === 'high'
    ? 'Your KPS signals readiness'
    : homeSummary.intelligence?.fatigue.level === 'high'
      ? 'Protect your KPS today'
      : homeSummary.lastRun
        ? 'Build your KPS with control'
        : 'Set your KPS baseline'

  return (
    <div className="pb-20 lg:pb-6">
      <div className="max-w-md lg:max-w-6xl mx-auto">
        <RunDashboardHeader targetKPS={targetKPS} isRunning={isRunning} hasGPSFix={hasGPSFix} />

        <DirectionalTodayCard
          kps={{ value: heroKpsValue, label: heroKpsLabel }}
          readiness={readinessText}
          fatigue={fatigueText}
          lastRun={lastRunText}
          suggestedTraining={suggested}
          onStartRun={handleStartRun}
          title={todayTitle}
          error={homeSummary.error}
          isRunning={isRunning}
          disabled={isActionLocked}
        />

        <section className="glass rounded-2xl p-6 mb-4" aria-labelledby="progress-heading">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-gray-400">KPS Progress</p>
              <h2 id="progress-heading" className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                {trendText} this week
              </h2>
            </div>
            <div className="text-right text-sm text-slate-600 dark:text-gray-300">
              <div>{homeSummary.runCount7d} runs in 7 days</div>
              <div>{homeSummary.streakDays}-day consistency</div>
            </div>
          </div>
          <div className="mb-5 rounded-lg border border-white/10 bg-black/5 p-3 text-sm text-slate-700 dark:bg-black/20 dark:text-gray-300">
            Weekly progress: {formatDistance(homeSummary.distance7d, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'}
          </div>
          <div className="lg:grid lg:grid-cols-[340px,1fr] lg:gap-8 lg:items-start">
            <RunGaugePanel
              displayKPS={displayKPS}
              displayText={liveKpsDisplay.text}
              displayLabel={liveKpsDisplay.label}
              progress={progress}
              isRunning={isRunning}
              timeToBeat={timeToBeat}
            />

            <div>
              <RunStatsPanel
                averagePace={averagePace}
                unitSystem={unitSystem}
                physioMode={physioMode}
                heartRate={heartRate}
                distance={distance}
                duration={duration}
              />
              <RunControlsPanel
                isRunning={isRunning}
                isPaused={isPaused}
                showAICoach={showAICoach}
                isActionLocked={isActionLocked}
                isAiAnalyzing={isAnalyzing}
                canResetIdle={distance > 0 || duration > 0}
                startRun={handleStartRun}
                pauseRun={handlePauseRun}
                resumeRun={handleResumeRun}
                stopRun={handleStopRun}
                resetRun={handleResetRun}
                openBeatPB={handleOpenBeatPB}
                openBeatRecents={handleOpenBeatRecents}
                handleAIAnalysis={handleGuardedAIAnalysis}
              />
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-5 mb-4 border border-emerald-500/20" aria-labelledby="coaching-heading">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">Coaching</p>
          <h2 id="coaching-heading" className="mt-1 text-xl font-black text-slate-900 dark:text-white">
            Recommendation
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-gray-300">{coachMessage}</p>
        </section>

        <nav className="glass rounded-2xl p-5 mb-4" aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="text-lg font-black text-slate-900 dark:text-white">Quick Actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { to: '/history', label: 'History' },
              { to: '/coaching', label: 'Coaching' },
              { to: '/chat', label: 'Chat' },
              { to: '/menu', label: 'Charts' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="shell-focus-ring rounded-lg border border-slate-300/80 px-4 py-3 text-center text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <RunDesktopSummary
          displayKPS={displayKPS}
          displayText={liveKpsDisplay.text}
          targetKPS={targetKPS}
          physioMode={physioMode}
        />

        <BeatTargetModal
          isOpen={showBeatPBModal}
          title={`Beat PB by ${beatPBPercent}%`}
          description={`Run at or faster than these to beat your PB by ${beatPBPercent}%:`}
          accent="amber"
          error={beatPBError}
          options={beatPBOptions}
          unitSystem={unitSystem}
          onClose={closeBeatPBModal}
        />

        <BeatTargetModal
          isOpen={showBeatRecentsModal}
          title={`Beat last ${beatRecentsCount} by ${beatPBPercent}%`}
          description={`Run at or faster than these to beat your recent PB (best of last ${beatRecentsCount} runs) by ${beatPBPercent}%:`}
          accent="violet"
          error={beatRecentsError}
          options={beatRecentsOptions}
          unitSystem={unitSystem}
          onClose={closeBeatRecentsModal}
        />

        <AICoachModal isAnalyzing={isAnalyzing} aiResult={aiResult} error={error} onClose={clearResult} />
      </div>
    </div>
  )
}
