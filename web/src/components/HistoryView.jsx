import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Activity } from 'lucide-react';
import { unifiedStorageService } from '../storage/sync/unifiedStorageService';
import { Run } from '../models/Run';

/**
 * History view showing all past runs
 */
export function HistoryView({ onNavigate }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    const allRuns = (await unifiedStorageService.getAllRuns())
      .map((r) => Run.fromJSON(r))
      .sort((a, b) => b.date - a.date);
    setRuns(allRuns);
    setLoading(false);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => onNavigate('home')}
            className="glass rounded-xl p-3 border border-white/10 hover:border-cyan-500/30 transition-all"
          >
            <ArrowLeft className="text-cyan-400" size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tight text-cyan-400">
              HISTORY
            </h1>
            <p className="text-gray-400 text-sm">{runs.length} runs recorded</p>
          </div>
        </div>

        {runs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-white/10">
            <Activity className="text-gray-600 mx-auto mb-4" size={48} />
            <h2 className="text-xl font-bold text-gray-400 mb-2">No Runs Yet</h2>
            <p className="text-gray-500 text-sm mb-6">
              Start your first run to see it here
            </p>
            <button
              onClick={() => onNavigate('run')}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl text-white font-bold shadow-lg transition-all"
            >
              Start Run
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <div
                key={run.id}
                onClick={() => onNavigate('run-detail', run.id)}
                className="glass rounded-xl p-5 border border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="text-gray-500" size={14} />
                      <span className="text-sm font-bold text-white">
                        {formatDate(run.date)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(run.date)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {(run.distance / 1000).toFixed(2)} km • {formatDuration(run.duration)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-cyan-400 group-hover:scale-110 transition-transform">
                      {run.kps ? run.kps.toFixed(1) : '---'}
                    </div>
                    <div className="text-xs text-gray-500 uppercase">KPS</div>
                    {run.setPb && (
                      <div className="text-[10px] font-bold text-green-400 mt-1">✅ NEW PB</div>
                    )}
                  </div>
                </div>

                {/* Additional metrics */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Pace</div>
                    <div className="text-sm font-bold text-gray-300">
                      {Math.floor(run.avgPace / 60)}:
                      {Math.floor(run.avgPace % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Heart Rate</div>
                    <div className="text-sm font-bold text-gray-300">
                      {Math.floor(run.avgHeartRate)} bpm
                    </div>
                  </div>
                  {run.formScore && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Form</div>
                      <div className="text-sm font-bold text-gray-300">
                        {Math.floor(run.formScore)}/100
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
