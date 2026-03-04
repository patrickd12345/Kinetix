import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRunStore } from '../store/runStore'
import { useSettingsStore } from '../store/settingsStore'
import { formatTime, formatDistance, formatPace, timeToAchieveKPS, distanceToAchieveKPS } from '@kinetix/core'
import { useLocationTracking } from '../hooks/useLocationTracking'
import { useAICoach } from '../hooks/useAICoach'
import { ensurePBInitialized, getRelativeKPS, getPB, getPBRun, calculateAbsoluteKPS, isMeaningfulRunForKPS, isValidKPS } from '../lib/kpsUtils'
import { getRunsPage } from '../lib/database'
import { getProfileForRun } from '../lib/authState'
import { KPS_SHORT } from '../lib/branding'
import { Play, Square, Pause, Flag, Heart, Sparkles, X, Trophy, TrendingUp } from 'lucide-react'
import { useAuth } from '../components/providers/useAuth'
import { toKinetixUserProfile } from '../lib/kinetixProfile'

export default function RunDashboard() {
  const {
    isRunning,
    isPaused,
    hasGPSFix,
    distance,
    duration,
    averagePace,
    liveKPS,
    heartRate,
    progress,
    timeToBeat,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
  } = useRunStore()
  
  const { targetKPS, unitSystem, physioMode, beatPBPercent, beatRecentsCount } = useSettingsStore()
  const { profile } = useAuth()
  const userProfile = profile ? toKinetixUserProfile(profile) : null
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
  }, [distance, duration, liveKPS, averagePace, targetKPS, userProfile])

  const displayKPS = useMemo(() => relativeKPS, [relativeKPS])

  const { isAnalyzing, aiResult, error, analyzeRun, clearResult } = useAICoach()
  const [showAICoach, setShowAICoach] = useState(false)
  const [showBeatPBModal, setShowBeatPBModal] = useState(false)
  type BeatPBOption =
    | { type: 'distance'; label: string; distanceKm: number; timeSeconds: number }
    | { type: 'time'; label: string; timeSeconds: number; distanceKm: number }
  const [beatPBOptions, setBeatPBOptions] = useState<BeatPBOption[] | null>(null)
  const [beatPBError, setBeatPBError] = useState<string | null>(null)
  const [showBeatRecentsModal, setShowBeatRecentsModal] = useState(false)
  const [beatRecentsOptions, setBeatRecentsOptions] = useState<BeatPBOption[] | null>(null)
  const [beatRecentsError, setBeatRecentsError] = useState<string | null>(null)

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
    const options: BeatPBOption[] = [
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
    const options: BeatPBOption[] = [
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

  return (
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-black italic tracking-wider">KINETIX</h1>
          <div
            role="status"
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
            isRunning 
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
              : hasGPSFix 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
          }`}>
            {isRunning ? 'LIVE' : hasGPSFix ? 'READY' : 'WAITING'}
          </div>
        </div>

        {/* Main Gauge Area */}
        <div className="glass rounded-2xl p-6 mb-4">
          {/* Progress Circle */}
          <div className="relative flex items-center justify-center mb-4">
            <svg className="w-48 h-48 transform -rotate-90">
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <circle cx="96" cy="96" r="84" stroke="#1a1a1a" strokeWidth="8" fill="transparent" opacity="0.5" />
              <circle 
                cx="96" cy="96" r="84" 
                stroke="url(#progressGradient)" 
                strokeWidth="7" 
                fill="transparent"
                strokeDasharray={2 * Math.PI * 84}
                strokeDashoffset={2 * Math.PI * 84 * (1 - Math.min(Math.max(progress, 0), 1))}
                className="transition-all duration-700 ease-out"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))' }}
              />
            </svg>
            
            {/* Kinetix Performance Score - Centered */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className="text-6xl font-black italic tracking-tight text-white">
                  {Math.floor(displayKPS)}
                </span>
                <div className="text-xs font-bold tracking-[0.3em] text-gray-400 uppercase mt-2">{KPS_SHORT}</div>
              </div>
            </div>
          </div>

          {/* Time to Beat */}
          {isRunning && timeToBeat && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Flag size={12} className={timeToBeat.includes("REACHED") ? "text-green-400" : "text-orange-400"} />
              <span className={`text-sm font-mono font-bold ${timeToBeat.includes("REACHED") ? "text-green-400" : "text-orange-400"}`}>
                {timeToBeat}
              </span>
            </div>
          )}

          {/* Runner Track */}
          {isRunning && (
            <div className="w-full h-8 relative mb-4">
              <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-900/50 rounded-full transform -translate-y-1/2" />
              <div 
                className="absolute top-1/2 left-0 h-2 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full transform -translate-y-1/2 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(Math.max(progress, 0), 1.0) * 100}%` }}
              />
              <div 
                className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out text-xl scale-x-[-1]"
                style={{ left: `${Math.min(Math.max(progress, 0), 1.0) * 100}%` }}
              >
                🏃
              </div>
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 text-lg">🏁</div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-xs text-gray-400 uppercase mb-1">PACE</div>
              <div className="text-xl font-black font-mono text-cyan-400">{formatPace(averagePace, unitSystem)}</div>
            </div>
            {physioMode && (
              <div className="glass rounded-xl p-3 text-center">
                <div className="text-xs text-gray-400 uppercase mb-1 flex items-center justify-center gap-1">
                  <Heart size={10} />
                  BPM
                </div>
                <div className={`text-xl font-black font-mono ${heartRate > 170 ? 'text-red-400' : 'text-white'}`}>
                  {Math.floor(heartRate)}
                </div>
              </div>
            )}
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-xs text-gray-400 uppercase mb-1">DIST</div>
              <div className="text-xl font-black font-mono text-purple-400">
                {formatDistance(distance, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'}
              </div>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-xs text-gray-400 uppercase mb-1">TIME</div>
              <div className="text-xl font-black font-mono text-white">{formatTime(duration)}</div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-col items-center gap-3">
            {!isRunning ? (
              <>
                <button
                  onClick={startRun}
                  aria-label="Start run"
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 shadow-lg shadow-green-500/50 flex items-center justify-center transition-all active:scale-95"
                >
                  <Play fill="white" size={28} className="ml-1" strokeWidth={0} />
                </button>
                
                {/* Beat PB */}
                <button
                  onClick={openBeatPB}
                  className="flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-bold text-amber-400 border border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all"
                >
                  <Trophy size={14} strokeWidth={2.5} />
                  BEAT PB
                </button>
                {/* Beat recents */}
                <button
                  onClick={openBeatRecents}
                  className="flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-bold text-violet-400 border border-violet-500/30 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all"
                >
                  <TrendingUp size={14} strokeWidth={2.5} />
                  BEAT RECENTS
                </button>

                {/* AI Coach Button */}
                {showAICoach && (
                  <button
                    onClick={handleAIAnalysis}
                    className="flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-bold text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all"
                  >
                    <Sparkles size={14} strokeWidth={2.5} />
                    ASK AI COACH
                  </button>
                )}
              </>
            ) : (
              <div className="flex gap-3">
                {isPaused ? (
                  <button
                    onClick={resumeRun}
                    aria-label="Resume run"
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Play fill="white" size={22} className="ml-1" strokeWidth={0} />
                  </button>
                ) : (
                  <button
                    onClick={pauseRun}
                    aria-label="Pause run"
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-lg shadow-yellow-500/50 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Pause fill="white" size={20} strokeWidth={0} />
                  </button>
                )}
                <button
                  onClick={stopRun}
                  aria-label="Stop run"
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/50 flex items-center justify-center transition-all active:scale-95"
                >
                  <Square fill="white" size={18} strokeWidth={0} />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Beat PB Modal */}
        {showBeatPBModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass border border-amber-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-black text-amber-400">Beat PB by {beatPBPercent}%</h3>
                <button
                  onClick={() => { setShowBeatPBModal(false); setBeatPBOptions(null); setBeatPBError(null) }}
                  aria-label="Close"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-300 mb-4">
                Run at or faster than these to beat your PB by {beatPBPercent}%:
              </p>
              {beatPBError ? (
                <p className="text-sm text-amber-300 mb-4">{beatPBError}</p>
              ) : beatPBOptions ? (
                <ul className="space-y-2 mb-4">
                  {beatPBOptions.map((opt) => {
                    const paceSecPerKm = opt.distanceKm > 0 ? opt.timeSeconds / opt.distanceKm : 0
                    return (
                      <li key={opt.label} className="flex justify-between items-center text-sm py-2 border-b border-gray-700/50 last:border-0 gap-2">
                        <span className="text-gray-300">{opt.label}</span>
                        <span className="text-right">
                          <span className="font-mono font-bold text-amber-400">
                            {opt.type === 'time'
                              ? `${formatDistance(opt.distanceKm * 1000, unitSystem)} ${unitSystem === 'metric' ? 'km' : 'mi'} in ${opt.label}`
                              : `${formatDistance(opt.distanceKm * 1000, unitSystem)} ${unitSystem === 'metric' ? 'km' : 'mi'} in ${formatTime(opt.timeSeconds)}`}
                          </span>
                          <span className="ml-2 text-gray-400 font-mono text-xs">
                            {paceSecPerKm > 0 ? formatPace(paceSecPerKm, unitSystem) + (unitSystem === 'metric' ? '/km' : '/mi') : '—'}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Loading…</p>
              )}
              <button
                onClick={() => { setShowBeatPBModal(false); setBeatPBOptions(null); setBeatPBError(null) }}
                className="w-full py-2.5 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-white text-sm font-bold border border-gray-700/50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Beat recents Modal */}
        {showBeatRecentsModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass border border-violet-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-black text-violet-400">Beat last {beatRecentsCount} by {beatPBPercent}%</h3>
                <button
                  onClick={() => { setShowBeatRecentsModal(false); setBeatRecentsOptions(null); setBeatRecentsError(null) }}
                  aria-label="Close"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-300 mb-4">
                Run at or faster than these to beat your recent PB (best of last {beatRecentsCount} runs) by {beatPBPercent}%:
              </p>
              {beatRecentsError ? (
                <p className="text-sm text-violet-300 mb-4">{beatRecentsError}</p>
              ) : beatRecentsOptions ? (
                <ul className="space-y-2 mb-4">
                  {beatRecentsOptions.map((opt) => {
                    const paceSecPerKm = opt.distanceKm > 0 ? opt.timeSeconds / opt.distanceKm : 0
                    return (
                      <li key={opt.label} className="flex justify-between items-center text-sm py-2 border-b border-gray-700/50 last:border-0 gap-2">
                        <span className="text-gray-300">{opt.label}</span>
                        <span className="text-right">
                          <span className="font-mono font-bold text-violet-400">
                            {opt.type === 'time'
                              ? `${formatDistance(opt.distanceKm * 1000, unitSystem)} ${unitSystem === 'metric' ? 'km' : 'mi'} in ${opt.label}`
                              : `${formatDistance(opt.distanceKm * 1000, unitSystem)} ${unitSystem === 'metric' ? 'km' : 'mi'} in ${formatTime(opt.timeSeconds)}`}
                          </span>
                          <span className="ml-2 text-gray-400 font-mono text-xs">
                            {paceSecPerKm > 0 ? formatPace(paceSecPerKm, unitSystem) + (unitSystem === 'metric' ? '/km' : '/mi') : '—'}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Loading…</p>
              )}
              <button
                onClick={() => { setShowBeatRecentsModal(false); setBeatRecentsOptions(null); setBeatRecentsError(null) }}
                className="w-full py-2.5 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-white text-sm font-bold border border-gray-700/50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* AI Coach Modal */}
        {(isAnalyzing || aiResult || error) && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              {isAnalyzing ? (
                <div className="text-center">
                  <div className="animate-pulse text-cyan-400 font-mono text-sm mb-2">ANALYZING...</div>
                  <div className="text-xs text-gray-400">Using AI to analyze your run</div>
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
