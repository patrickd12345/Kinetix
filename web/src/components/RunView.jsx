import React, { useState } from 'react';
import { Square, Play, Pause, Flag, Heart } from 'lucide-react';
import { useRunTracker } from '../hooks/useRunTracker';
import { unifiedStorageService } from '../storage/sync/unifiedStorageService';

/**
 * Run tracking view with NPI as the star feature
 */
export function RunView({ settings, onSave, onCancel }) {
  const { 
    isRunning, 
    gpsStatus, 
    distance, 
    duration, 
    pace, 
    npi, 
    heartRate, 
    timeToBeat, 
    progress,
    start,
    stop,
    pause,
    resume,
    reset,
    getRunSummary,
  } = useRunTracker(settings?.targetNPI || 135, settings?.unitSystem || 'metric');

  const [isPaused, setIsPaused] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatPace = () => {
    if (!pace || !isFinite(pace)) return '0:00';
    const adjustedPace = settings?.unitSystem === 'imperial' ? pace * 1.60934 : pace;
    return `${Math.floor(adjustedPace / 60)}:${Math.floor(adjustedPace % 60).toString().padStart(2, '0')}`;
  };

  const formatDistance = () => {
    const dist = settings?.unitSystem === 'metric' 
      ? distance / 1000 
      : (distance / 1000) * 0.621371;
    return dist.toFixed(2);
  };

  const handleStart = async () => {
    await start();
    setIsPaused(false);
  };

  const handlePause = () => {
    pause();
    setIsPaused(true);
  };

  const handleResume = () => {
    resume();
    setIsPaused(false);
  };

  const handleStop = () => {
    stop();
    if (distance > 100 && duration > 10) {
      setShowSaveDialog(true);
    } else {
      reset();
      onCancel?.();
    }
  };

  const handleSave = async () => {
    const run = getRunSummary();
    // Use unified storage service for automatic cloud sync
    await unifiedStorageService.saveRun(run);
    setShowSaveDialog(false);
    reset();
    onSave?.(run);
  };

  const handleDiscard = () => {
    setShowSaveDialog(false);
    reset();
    onCancel?.();
  };

  const getStatusColor = () => {
    if (isRunning) return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/20';
    if (gpsStatus === 'good' || gpsStatus === 'searching') return 'text-green-400 border-green-500/30 bg-green-500/20';
    if (gpsStatus === 'poor') return 'text-orange-400 border-orange-500/30 bg-orange-500/20';
    return 'text-gray-400 border-gray-700/50 bg-gray-800/50';
  };

  const getStatusText = () => {
    if (isRunning) return 'LIVE';
    if (isPaused) return 'PAUSED';
    if (gpsStatus === 'searching') return 'SEARCHING';
    if (gpsStatus === 'good') return 'READY';
    if (gpsStatus === 'poor') return 'POOR GPS';
    if (gpsStatus === 'denied') return 'GPS DENIED';
    return 'WAITING';
  };

  const targetNPI = settings?.targetNPI || 135;
  const npiReached = npi >= targetNPI && npi > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black italic tracking-tight text-cyan-400">
            KINETIX
          </h1>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor()}`}>
            {getStatusText()}
          </div>
        </div>

        {/* Target NPI Badge */}
        <div className="flex items-center justify-center mb-6">
          <div className="glass px-4 py-2 rounded-full border border-cyan-500/20 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">TARGET</span>
            <span className="text-lg font-black text-cyan-400">{Math.round(targetNPI)}</span>
          </div>
        </div>
      </div>

      {/* Main Content - NPI as Star */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
        {/* NPI Display - Large and Prominent */}
        <div className="relative mb-8">
          {/* Progress Circle */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="w-64 h-64 transform -rotate-90 absolute inset-0">
              <defs>
                <linearGradient id="npiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={npiReached ? "#4ade80" : "#22d3ee"} />
                  <stop offset="100%" stopColor={npiReached ? "#16a34a" : "#06b6d4"} />
                </linearGradient>
              </defs>
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="#1a1a1a"
                strokeWidth="12"
                fill="transparent"
                opacity="0.5"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="url(#npiGradient)"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 120}
                strokeDashoffset={2 * Math.PI * 120 * (1 - Math.min(Math.max(progress, 0), 1))}
                className="transition-all duration-700 ease-out"
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 12px ${npiReached ? 'rgba(34, 197, 94, 0.6)' : 'rgba(6, 182, 212, 0.6)'})`,
                }}
              />
            </svg>
            
            {/* NPI Value - Centered */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-7xl font-black italic tracking-tight drop-shadow-2xl ${npiReached ? 'text-green-400' : 'text-white'}`}>
                {Math.floor(npi) || '---'}
              </div>
              <div className="text-xs font-bold tracking-[0.3em] text-gray-400 uppercase mt-2">
                NPI
              </div>
            </div>
          </div>

          {/* Time to Beat */}
          {isRunning && timeToBeat && (
            <div className="mt-4 flex items-center justify-center">
              <div className={`glass px-4 py-2 rounded-xl border shadow-lg flex items-center gap-2 ${
                timeToBeat.includes('REACHED') 
                  ? 'border-green-500/30' 
                  : 'border-orange-500/30'
              }`}>
                <Flag 
                  size={12} 
                  className={timeToBeat.includes('REACHED') ? 'text-green-400' : 'text-orange-400'} 
                  strokeWidth={2.5} 
                />
                <span className={`text-sm font-mono font-bold ${
                  timeToBeat.includes('REACHED') ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {timeToBeat}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-6">
          <div className="glass rounded-xl p-4 text-center border border-white/10">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              PACE
            </div>
            <div className="text-2xl font-black text-cyan-400 font-mono">
              {formatPace()}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              {settings?.unitSystem === 'imperial' ? '/mi' : '/km'}
            </div>
          </div>

          <div className="glass rounded-xl p-4 text-center border border-white/10">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              DIST
            </div>
            <div className="text-2xl font-black text-purple-400 font-mono">
              {formatDistance()}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              {settings?.unitSystem === 'imperial' ? 'mi' : 'km'}
            </div>
          </div>

          <div className="glass rounded-xl p-4 text-center border border-white/10">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              TIME
            </div>
            <div className="text-2xl font-black text-orange-400 font-mono">
              {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Heart Rate (if physio mode) */}
        {settings?.physioMode && (
          <div className="glass rounded-xl p-4 w-full max-w-md mb-6 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="text-red-400" size={20} />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Heart Rate
              </span>
            </div>
            <span className="text-2xl font-black text-red-400">
              {Math.floor(heartRate)}
            </span>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex items-center gap-4 mt-4">
          {!isRunning && !isPaused && (
            <button
              onClick={handleStart}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 shadow-2xl shadow-green-500/50 flex items-center justify-center transition-all duration-300 active:scale-95"
            >
              <Play fill="white" size={28} className="ml-1" strokeWidth={0} />
            </button>
          )}

          {isRunning && (
            <>
              <button
                onClick={handlePause}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 shadow-xl shadow-yellow-500/50 flex items-center justify-center transition-all duration-300 active:scale-95"
              >
                <Pause fill="white" size={20} strokeWidth={0} />
              </button>
              <button
                onClick={handleStop}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 shadow-2xl shadow-red-500/50 flex items-center justify-center transition-all duration-300 active:scale-95"
              >
                <Square fill="white" size={22} strokeWidth={0} />
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={handleResume}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 shadow-2xl shadow-green-500/50 flex items-center justify-center transition-all duration-300 active:scale-95"
              >
                <Play fill="white" size={28} className="ml-1" strokeWidth={0} />
              </button>
              <button
                onClick={handleStop}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 shadow-xl shadow-red-500/50 flex items-center justify-center transition-all duration-300 active:scale-95"
              >
                <Square fill="white" size={18} strokeWidth={0} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className="glass border border-cyan-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black text-cyan-400 mb-4 text-center">
              Save Run?
            </h3>
            <div className="space-y-2 mb-6 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Distance:</span>
                <span className="font-bold">{formatDistance()} {settings?.unitSystem === 'imperial' ? 'mi' : 'km'}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-bold">{formatTime(duration)}</span>
              </div>
              <div className="flex justify-between">
                <span>NPI:</span>
                <span className="font-bold text-cyan-400">{Math.floor(npi)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDiscard}
                className="flex-1 py-3 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-gray-300 text-sm font-bold border border-gray-700/50 transition-all"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl text-white text-sm font-bold shadow-lg transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
