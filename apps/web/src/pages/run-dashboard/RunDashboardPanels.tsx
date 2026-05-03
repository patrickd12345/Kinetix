import { formatDistance, formatPace, formatTime } from '@kinetix/core'
import { Flag, Heart, Pause, Play, RotateCcw, Sparkles, Square, TrendingUp, Trophy } from 'lucide-react'
import { KPS_SHORT } from '../../lib/branding'

interface RunDashboardHeaderProps {
  targetKPS: number
  isRunning: boolean
  hasGPSFix: boolean
}

interface RunGaugePanelProps {
  displayKPS: number
  displayText: string
  displayLabel: string
  progress: number
  isRunning: boolean
  timeToBeat: string | null
  avgKPS?: number
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
  canResetIdle: boolean
  startRun: () => void
  pauseRun: () => void
  resumeRun: () => void
  stopRun: () => void
  resetRun: () => void
  openBeatPB: () => void
  openBeatRecents: () => void
  handleAIAnalysis: () => void
}

interface RunDesktopSummaryProps {
  displayKPS: number
  displayText: string
  targetKPS: number
  physioMode: boolean
}

export function RunDashboardHeader({ targetKPS, isRunning, hasGPSFix }: RunDashboardHeaderProps) {
  return (
    <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-black tracking-wide text-slate-900 dark:text-white">Run Dashboard</h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-gray-400">Live performance, pacing, and KPS guidance</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="rounded-lg border border-slate-200/90 bg-slate-100/80 px-3 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          Target {Math.round(targetKPS)} {KPS_SHORT}
        </div>
        <div
          role="status"
          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
            isRunning
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : hasGPSFix
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'border border-slate-300/70 bg-slate-200/90 text-slate-800 dark:border-gray-700/50 dark:bg-gray-800/50 dark:text-gray-400'
          }`}
        >
          {isRunning ? 'LIVE' : hasGPSFix ? 'READY' : 'WAITING'}
        </div>
      </div>
    </div>
  )
}

export function RunGaugePanel({ displayKPS: _displayKPS, displayText, displayLabel, progress, isRunning, timeToBeat, avgKPS }: RunGaugePanelProps) {
  return (
    <div>
      <div className="relative flex items-center justify-center mb-4">
        <svg
          className="w-48 h-48 transform -rotate-90"
          role="img"
          aria-label={`${displayLabel}: ${displayText}. Progress toward target: ${Math.round(Math.min(Math.max(progress, 0), 1) * 100)} percent.`}
        >
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
            <span className="text-6xl font-black tracking-tight text-slate-900 dark:text-white">
              {displayText}
            </span>
            <div className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-600 dark:text-gray-400">
              {displayLabel}
            </div>
          </div>
        </div>
      </div>

      {isRunning && avgKPS != null && avgKPS > 0 && (
        <div className="flex items-center justify-center gap-3 mb-3 text-xs font-bold uppercase tracking-wide">
          <span className="text-cyan-400">
            Live&nbsp;<span className="text-lg font-black">{displayText === '--' ? '--' : displayText}</span>
          </span>
          <span className="text-slate-500 dark:text-gray-600">|</span>
          <span className="text-slate-500 dark:text-gray-400">
            Avg&nbsp;<span className="text-lg font-black text-slate-700 dark:text-gray-300">{Math.floor(avgKPS)}</span>
          </span>
        </div>
      )}

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


function getHeartRateDisplayState(hr: number) {
  // TODO: Native apps can distinguish sensor states like Finding HR, Enable HR, HR lost.
  // For now in PWA, if HR is missing or at the default uninitialized 70, we display No HR.
  if (!hr || hr === 70) return { label: 'No HR', color: 'text-slate-500' }
  return { label: Math.floor(hr).toString(), color: hr > 170 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white' }
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
        <div className="text-xs text-slate-600 dark:text-gray-400 uppercase mb-1">PACE</div>
        <div className="text-lg sm:text-xl font-black font-mono text-cyan-400 whitespace-nowrap overflow-visible">{formatPace(averagePace, unitSystem)}</div>
      </div>
      {physioMode && (
        <div className="glass rounded-xl p-3 text-center">
          <div className="text-xs text-slate-600 dark:text-gray-400 uppercase mb-1 flex items-center justify-center gap-1">
            <Heart size={10} />
            BPM
          </div>
          {
            (() => {
              const hrState = getHeartRateDisplayState(heartRate)
              return (
                <div className={`text-xl font-black font-mono ${hrState.color}`}>
                  {hrState.label}
                </div>
              )
            })()
          }
        </div>
      )}
      <div className="glass rounded-xl p-3 text-center">
        <div className="text-xs text-slate-600 dark:text-gray-400 uppercase mb-1">DIST</div>
        <div className="text-xl font-black font-mono text-purple-400">
          {formatDistance(distance, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'}
        </div>
      </div>
      <div className="glass rounded-xl p-3 text-center">
        <div className="text-xs text-slate-600 dark:text-gray-400 uppercase mb-1">TIME</div>
        <div className="text-xl font-black font-mono text-slate-900 dark:text-white">{formatTime(duration)}</div>
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
  canResetIdle,
  startRun,
  pauseRun,
  resumeRun,
  stopRun,
  resetRun,
  openBeatPB,
  openBeatRecents,
  handleAIAnalysis,
}: RunControlsPanelProps) {
  return (
    <div className="flex flex-col items-center lg:items-start gap-3">
      {!isRunning ? (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetRun}
              aria-label="Reset session"
              title="Clear metrics and start over"
              disabled={isActionLocked || !canResetIdle}
              className="w-14 h-14 rounded-full border border-slate-400/40 bg-slate-700/50 hover:bg-slate-600/60 text-slate-200 shadow-md flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <RotateCcw size={22} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={startRun}
              aria-label="Start run"
              disabled={isActionLocked}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 shadow-lg shadow-green-500/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Play fill="white" size={28} className="ml-1" strokeWidth={0} />
            </button>
          </div>

          <button
            type="button"
            onClick={openBeatPB}
            disabled={isActionLocked}
            className="flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-bold text-amber-400 border border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Trophy size={14} strokeWidth={2.5} />
            BEAT PB
          </button>

          <button
            type="button"
            onClick={openBeatRecents}
            disabled={isActionLocked}
            className="flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-bold text-violet-400 border border-violet-500/30 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <TrendingUp size={14} strokeWidth={2.5} />
            BEAT RECENTS
          </button>

          {showAICoach && (
            <button
              type="button"
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
              type="button"
              onClick={resumeRun}
              aria-label="Resume run"
              disabled={isActionLocked}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Play fill="white" size={22} className="ml-1" strokeWidth={0} />
            </button>
          ) : (
            <button
              type="button"
              onClick={pauseRun}
              aria-label="Pause run"
              disabled={isActionLocked}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-lg shadow-yellow-500/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Pause fill="white" size={20} strokeWidth={0} />
            </button>
          )}
          <button
            type="button"
            onClick={stopRun}
            aria-label="Stop run"
            disabled={isActionLocked}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Square fill="white" size={18} strokeWidth={0} />
          </button>
          <button
            type="button"
            onClick={resetRun}
            aria-label="Reset session"
            title="Discard run and clear metrics"
            disabled={isActionLocked}
            className="w-16 h-16 rounded-full border border-slate-400/40 bg-slate-700/50 hover:bg-slate-600/60 text-slate-200 shadow-md flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15"
          >
            <RotateCcw size={22} strokeWidth={2.25} />
          </button>
        </div>
      )}
    </div>
  )
}

export function RunDesktopSummary({ displayKPS, displayText, targetKPS, physioMode }: RunDesktopSummaryProps) {
  return (
    <div className="glass mb-4 hidden rounded-2xl border border-slate-200/90 p-4 dark:border-white/10 lg:block">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-gray-400 mb-1">Current KPS</div>
          <div className="font-black text-slate-900 dark:text-white">{displayText === '--' ? displayText : Math.floor(displayKPS)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-gray-400 mb-1">Target KPS</div>
          <div className="font-black text-cyan-700 dark:text-cyan-300">{Math.round(targetKPS)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-gray-400 mb-1">Mode</div>
          <div className="font-black text-slate-800 dark:text-gray-200">{physioMode ? 'Physio' : 'Standard'}</div>
        </div>
      </div>
    </div>
  )
}

