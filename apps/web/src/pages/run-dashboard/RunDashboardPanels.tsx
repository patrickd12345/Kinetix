import { formatDistance, formatPace, formatTime } from '@kinetix/core'
import { Flag, Heart, Pause, Play, Sparkles, Square, TrendingUp, Trophy } from 'lucide-react'
import { KPS_SHORT } from '../../lib/branding'

interface RunDashboardHeaderProps {
  targetKPS: number
  isRunning: boolean
  hasGPSFix: boolean
}

interface RunGaugePanelProps {
  displayKPS: number
  progress: number
  isRunning: boolean
  timeToBeat: string | null
}

interface RunStatsPanelProps {
  averagePace: number
  unitSystem: 'metric' | 'imperial'
  physioMode: boolean
  heartRate: number
  distance: number
  duration: number
}

interface RunControlsPanelProps {
  isRunning: boolean
  isPaused: boolean
  showAICoach: boolean
  isActionLocked: boolean
  isAiAnalyzing: boolean
  startRun: () => void
  pauseRun: () => void
  resumeRun: () => void
  stopRun: () => void
  openBeatPB: () => void
  openBeatRecents: () => void
  handleAIAnalysis: () => void
}

interface RunDesktopSummaryProps {
  displayKPS: number
  targetKPS: number
  physioMode: boolean
}

export function RunDashboardHeader({ targetKPS, isRunning, hasGPSFix }: RunDashboardHeaderProps) {
  return (
    <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-black tracking-wide">Run Dashboard</h1>
        <p className="text-xs text-gray-400 mt-1">Live performance, pacing, and KPS guidance</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="px-3 py-1 rounded-lg border border-white/10 text-xs text-gray-300 bg-white/5">
          Target {Math.round(targetKPS)} {KPS_SHORT}
        </div>
        <div
          role="status"
          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
            isRunning
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : hasGPSFix
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
          }`}
        >
          {isRunning ? 'LIVE' : hasGPSFix ? 'READY' : 'WAITING'}
        </div>
      </div>
    </div>
  )
}

export function RunGaugePanel({ displayKPS, progress, isRunning, timeToBeat }: RunGaugePanelProps) {
  return (
    <div>
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
            cx="96"
            cy="96"
            r="84"
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

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <span className="text-6xl font-black tracking-tight text-white">{Math.floor(displayKPS)}</span>
            <div className="text-xs font-bold tracking-[0.3em] text-gray-400 uppercase mt-2">{KPS_SHORT}</div>
          </div>
        </div>
      </div>

      {isRunning && timeToBeat && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <Flag size={12} className={timeToBeat.includes('REACHED') ? 'text-green-400' : 'text-orange-400'} />
          <span className={`text-sm font-mono font-bold ${timeToBeat.includes('REACHED') ? 'text-green-400' : 'text-orange-400'}`}>
            {timeToBeat}
          </span>
        </div>
      )}

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
    </div>
  )
}

export function RunStatsPanel({
  averagePace,
  unitSystem,
  physioMode,
  heartRate,
  distance,
  duration,
}: RunStatsPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-3">
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
  )
}

export function RunControlsPanel({
  isRunning,
  isPaused,
  showAICoach,
  isActionLocked,
  isAiAnalyzing,
  startRun,
  pauseRun,
  resumeRun,
  stopRun,
  openBeatPB,
  openBeatRecents,
  handleAIAnalysis,
}: RunControlsPanelProps) {
  return (
    <div className="flex flex-col items-center lg:items-start gap-3">
      {!isRunning ? (
        <>
          <button
            onClick={startRun}
            aria-label="Start run"
            disabled={isActionLocked}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 shadow-lg shadow-green-500/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Play fill="white" size={28} className="ml-1" strokeWidth={0} />
          </button>

          <button
            onClick={openBeatPB}
            disabled={isActionLocked}
            className="flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-bold text-amber-400 border border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Trophy size={14} strokeWidth={2.5} />
            BEAT PB
          </button>

          <button
            onClick={openBeatRecents}
            disabled={isActionLocked}
            className="flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-bold text-violet-400 border border-violet-500/30 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <TrendingUp size={14} strokeWidth={2.5} />
            BEAT RECENTS
          </button>

          {showAICoach && (
            <button
              onClick={handleAIAnalysis}
              disabled={isActionLocked || isAiAnalyzing}
              className="flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-bold text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
              disabled={isActionLocked}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Play fill="white" size={22} className="ml-1" strokeWidth={0} />
            </button>
          ) : (
            <button
              onClick={pauseRun}
              aria-label="Pause run"
              disabled={isActionLocked}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-lg shadow-yellow-500/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Pause fill="white" size={20} strokeWidth={0} />
            </button>
          )}
          <button
            onClick={stopRun}
            aria-label="Stop run"
            disabled={isActionLocked}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Square fill="white" size={18} strokeWidth={0} />
          </button>
        </div>
      )}
    </div>
  )
}

export function RunDesktopSummary({ displayKPS, targetKPS, physioMode }: RunDesktopSummaryProps) {
  return (
    <div className="hidden lg:block glass rounded-2xl p-4 mb-4 border border-white/10">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Current KPS</div>
          <div className="font-black text-white">{Math.floor(displayKPS)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Target KPS</div>
          <div className="font-black text-cyan-300">{Math.round(targetKPS)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Mode</div>
          <div className="font-black text-gray-200">{physioMode ? 'Physio' : 'Standard'}</div>
        </div>
      </div>
    </div>
  )
}

