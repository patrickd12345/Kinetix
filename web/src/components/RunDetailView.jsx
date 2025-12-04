import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, MapPin, Activity, TrendingUp } from 'lucide-react';
import { unifiedStorageService } from '../storage/sync/unifiedStorageService';
import { Run } from '../models/Run';
import { AICoachService } from '../services/aiCoachService';

/**
 * Detailed view of a single run
 */
export function RunDetailView({ runId, onNavigate }) {
  const [run, setRun] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [settings, setSettings] = useState(null);
  const [useRAG, setUseRAG] = useState(true);

  useEffect(() => {
    loadRun();
  }, [runId]);

  const loadRun = async () => {
    const [runData, settingsData] = await Promise.all([
      unifiedStorageService.getRun(runId),
      unifiedStorageService.getSettings(),
    ]);
    
    if (runData) {
      setRun(Run.fromJSON(runData));
    }
    setSettings(settingsData);
    setLoading(false);
  };

  const handleAnalyze = async () => {
    if (!run || !settings) return;
    
    setAnalyzing(true);
    try {
      const analysis = await AICoachService.analyzeRun(run, settings.targetNPI, useRAG);
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('Failed to analyze:', error);
      alert('Failed to get AI analysis. Make sure Ollama is running if using local LLM.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Run not found
      </div>
    );
  }

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => onNavigate('history')}
            className="glass rounded-xl p-3 border border-white/10 hover:border-cyan-500/30 transition-all"
          >
            <ArrowLeft className="text-cyan-400" size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tight text-cyan-400">
              RUN DETAILS
            </h1>
            <p className="text-gray-400 text-sm">{formatDate(run.date)}</p>
          </div>
        </div>

        {/* NPI Showcase */}
        <div className="glass rounded-3xl p-8 border border-cyan-500/20 shadow-2xl mb-6">
          <div className="text-center">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Normalized Performance Index
            </div>
            <div className="text-8xl font-black italic text-cyan-400 mb-2">
              {Math.floor(run.avgNPI)}
            </div>
            {settings && (
              <div className="text-sm text-gray-400">
                Target: {Math.floor(settings.targetNPI)} •{' '}
                {run.avgNPI >= settings.targetNPI ? (
                  <span className="text-green-400">Target Achieved! 🎉</span>
                ) : (
                  <span className="text-orange-400">
                    {Math.floor(settings.targetNPI - run.avgNPI)} points to go
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-white/10 text-center">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
              Distance
            </div>
            <div className="text-2xl font-black text-purple-400">
              {(run.distance / 1000).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">km</div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10 text-center">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
              Duration
            </div>
            <div className="text-2xl font-black text-orange-400">
              {formatDuration(run.duration)}
            </div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10 text-center">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
              Pace
            </div>
            <div className="text-2xl font-black text-cyan-400">
              {Math.floor(run.avgPace / 60)}:
              {Math.floor(run.avgPace % 60).toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-500">/km</div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10 text-center">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
              Heart Rate
            </div>
            <div className="text-2xl font-black text-red-400">
              {Math.floor(run.avgHeartRate)}
            </div>
            <div className="text-xs text-gray-500">bpm</div>
          </div>
        </div>

        {/* Form Metrics */}
        {(run.avgCadence || run.formScore) && (
          <div className="glass rounded-xl p-6 border border-white/10 mb-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="text-purple-400" size={20} />
              Form Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {run.avgCadence && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Cadence</div>
                  <div className="text-xl font-bold text-white">
                    {Math.floor(run.avgCadence)} spm
                  </div>
                </div>
              )}
              {run.formScore && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Form Score</div>
                  <div className="text-xl font-bold text-white">
                    {Math.floor(run.formScore)}/100
                  </div>
                </div>
              )}
              {run.avgVerticalOscillation && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Vertical Osc.</div>
                  <div className="text-xl font-bold text-white">
                    {run.avgVerticalOscillation.toFixed(1)} cm
                  </div>
                </div>
              )}
              {run.avgGroundContactTime && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">GCT</div>
                  <div className="text-xl font-bold text-white">
                    {run.avgGroundContactTime.toFixed(0)} ms
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Analysis */}
        <div className="glass rounded-xl p-6 border border-white/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="text-cyan-400" size={20} />
              AI Coach Analysis
              {aiAnalysis?.similarRunsCount > 0 && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <TrendingUp size={12} />
                  {aiAnalysis.similarRunsCount} similar runs
                </span>
              )}
            </h2>
            {!aiAnalysis && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl text-white text-sm font-bold shadow-lg transition-all disabled:opacity-50"
              >
                {analyzing ? 'Analyzing...' : 'Analyze Run'}
              </button>
            )}
          </div>
          {aiAnalysis ? (
            <div>
              <h3 className="text-base font-black text-cyan-400 mb-3">
                {aiAnalysis.title}
              </h3>
              <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent my-3" />
              <p className="text-sm text-gray-200 leading-relaxed">
                {aiAnalysis.insight}
              </p>
              {aiAnalysis.similarRunsCount > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-400">
                    Analysis enhanced with context from {aiAnalysis.similarRunsCount} similar past runs
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Get AI-powered insights about your run performance
            </p>
          )}
        </div>

        {/* Route Info */}
        {run.routeData && run.routeData.length > 0 && (
          <div className="glass rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <MapPin className="text-green-400" size={20} />
              Route
            </h2>
            <p className="text-sm text-gray-400">
              {run.routeData.length} GPS points recorded
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Map visualization coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

