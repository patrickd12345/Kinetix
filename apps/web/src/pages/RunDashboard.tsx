import { useEffect, useState } from 'react'
import { useRunStore } from '../store/runStore'
import { useSettingsStore } from '../store/settingsStore'
import { formatTime, formatDistance, formatPace } from '@kinetix/core'
import { useLocationTracking } from '../hooks/useLocationTracking'
import { useAICoach } from '../hooks/useAICoach'
import { Play, Square, Pause, Flag, Heart, Sparkles, X } from 'lucide-react'

export default function RunDashboard() {
  const {
    isRunning,
    isPaused,
    hasGPSFix,
    distance,
    duration,
    averagePace,
    liveKps,
    heartRate,
    progress,
    timeToBeat,
    pbEq5kSec,
    lastRunKps,
    lastRunSetPb,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
  } = useRunStore()
  
  const { targetKps, unitSystem, physioMode } = useSettingsStore()
  
  // Start location tracking hook
  useLocationTracking()
  
  // AI Coach
  const { isAnalyzing, aiResult, error, analyzeRun, clearResult } = useAICoach()
  const [showAICoach, setShowAICoach] = useState(false)
  
  // Show AI Coach button after run stops
  useEffect(() => {
    if (!isRunning && distance > 0 && duration > 0) {
      setShowAICoach(true)
    } else {
      setShowAICoach(false)
    }
  }, [isRunning, distance, duration])
  
  const handleAIAnalysis = async () => {
    const distanceKm = distance / 1000
    const paceString = formatPace(averagePace, unitSystem)
    await analyzeRun(
      distanceKm,
      paceString,
      lastRunKps ?? liveKps,
      targetKps,
      duration,
      heartRate > 70 ? heartRate : undefined
    )
  }

  return (
    <div className="pb-20">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-black italic tracking-wider">KINETIX</h1>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
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
          {/* Target Badge */}
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full glass border border-cyan-500/20">
              <span className="text-xs font-semibold text-gray-400 uppercase">TARGET</span>
              <span className="text-sm font-black text-cyan-400">{Math.round(targetKps)}</span>
            </div>
          </div>

          {/* Progress Circle */}
          <div className="relative flex items-center justify-center mb-4">
            <svg className="w-48 h-48 transform -rotate-90">
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={liveKps >= targetKps ? "#4ade80" : "#22d3ee"} />
                  <stop offset="100%" stopColor={liveKps >= targetKps ? "#16a34a" : "#06b6d4"} />
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
                style={{ filter: `drop-shadow(0 0 8px ${liveKps >= targetKps ? 'rgba(34, 197, 94, 0.5)' : 'rgba(6, 182, 212, 0.5)'})` }}
              />
            </svg>
            
            {/* KPS Value - Centered */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className={`text-6xl font-black italic tracking-tight ${liveKps >= targetKps ? 'text-green-400' : 'text-white'}`}>
                  {pbEq5kSec ? liveKps.toFixed(1) : '--'}
                </span>
                <div className="text-xs font-bold tracking-[0.3em] text-gray-400 uppercase mt-2">KPS</div>
              </div>
            </div>
          </div>

          {/* KPS context / PB messaging */}
          {!isRunning && lastRunKps != null && (
            <div className="text-center mb-4">
              {lastRunSetPb ? (
                <div className="text-sm font-bold text-green-400">
                  KPS 100 ✅ New lifetime PB
                </div>
              ) : (
                <div className="text-sm font-bold text-gray-200">
                  KPS {lastRunKps.toFixed(1)} — {Math.round(lastRunKps)}% of your lifetime best
                </div>
              )}
            </div>
          )}
          {!isRunning && pbEq5kSec == null && (
            <div className="text-center mb-4">
              <div className="text-xs text-gray-400">Your first run will set your lifetime PB reference.</div>
            </div>
          )}

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
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 shadow-lg shadow-green-500/50 flex items-center justify-center transition-all active:scale-95"
                >
                  <Play fill="white" size={28} className="ml-1" strokeWidth={0} />
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
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Play fill="white" size={22} className="ml-1" strokeWidth={0} />
                  </button>
                ) : (
                  <button
                    onClick={pauseRun}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-lg shadow-yellow-500/50 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Pause fill="white" size={20} strokeWidth={0} />
                  </button>
                )}
                <button
                  onClick={() => void stopRun()}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/50 flex items-center justify-center transition-all active:scale-95"
                >
                  <Square fill="white" size={18} strokeWidth={0} />
                </button>
              </div>
            )}
          </div>
        </div>
        
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
