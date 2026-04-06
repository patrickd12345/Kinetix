import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRunStore } from '../store/runStore'
import { useSettingsStore } from '../store/settingsStore'
import { formatPace, timeToAchieveKPS, distanceToAchieveKPS } from '@kinetix/core'
import { useLocationTracking } from '../hooks/useLocationTracking'
import { useAICoach } from '../hooks/useAICoach'
import { ensurePBInitialized, getRelativeKPS, getPB, getPBRun, calculateAbsoluteKPS, isMeaningfulRunForKPS, isValidKPS } from '../lib/kpsUtils'
import { getRunsPage } from '../lib/database'
import { getProfileForRun } from '../lib/authState'
import { useAuth } from '../components/providers/useAuth'
import { useStableKinetixUserProfile } from '../hooks/useStableKinetixUserProfile'
import { RunDashboardHeader, RunGaugePanel, RunStatsPanel, RunControlsPanel, RunDesktopSummary } from './run-dashboard/RunDashboardPanels'
import { AICoachModal, BeatTargetModal } from './run-dashboard/RunDashboardModals'
import type { BeatTargetOption } from './run-dashboard/types'

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
  useLocationTracking()

  useEffect(() => {
    if (!userProfile || !(distance > 0 && duration > 0)) {
      setRelativeKPS(0)
      return
    }
    const tempRun: import('../lib/database').RunRecord = {
      date: new Date().toISOString(),
      distance,
      duration,
      averagePace,
      targetKPS,
      locations: [],
      splits: [],
    }
    ensurePBInitialized(userProfile)
      .then(() => getRelativeKPS(tempRun, userProfile))
      .then(setRelativeKPS)
      .catch(() => setRelativeKPS(0))
  }, [distance, duration, averagePace, targetKPS, userProfile])

  const displayKPS = useMemo(() => relativeKPS, [relativeKPS])

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
    let bestKPS = 0
    for (const run of meaningful) {
      const profileForRun = await getProfileForRun(run)
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

  return (
    <div className="pb-20 lg:pb-6">
      <div className="max-w-md lg:max-w-6xl mx-auto">
        <RunDashboardHeader targetKPS={targetKPS} isRunning={isRunning} hasGPSFix={hasGPSFix} />

        <div className="glass rounded-2xl p-6 mb-4">
          <div className="lg:grid lg:grid-cols-[340px,1fr] lg:gap-8 lg:items-start">
            <RunGaugePanel displayKPS={displayKPS} progress={progress} isRunning={isRunning} timeToBeat={timeToBeat} />

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
        </div>

        <RunDesktopSummary displayKPS={displayKPS} targetKPS={targetKPS} physioMode={physioMode} />

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
