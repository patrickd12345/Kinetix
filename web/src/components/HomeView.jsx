import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, History, Settings, Play } from 'lucide-react';
import { unifiedStorageService } from '../storage/sync/unifiedStorageService';
import { Run } from '../models/Run';

/**
 * Homepage with NPI as the star feature
 */
export function HomeView({ onNavigate, onStartRun }) {
  const [recentRuns, setRecentRuns] = useState([]);
  const [bestNPI, setBestNPI] = useState(null);
  const [averageNPI, setAverageNPI] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const runs = (await unifiedStorageService.getAllRuns())
      .map((r) => Run.fromJSON(r))
      .sort((a, b) => b.date - a.date);
    
    setRecentRuns(runs.slice(0, 3));
    
    if (runs.length > 0) {
      const npis = runs.map((r) => r.avgNPI).filter((n) => n > 0);
      if (npis.length > 0) {
        setBestNPI(Math.max(...npis));
        setAverageNPI(npis.reduce((a, b) => a + b, 0) / npis.length);
      }
    }
    
    setSettings(await unifiedStorageService.getSettings());
  };

  const formatNPI = (npi) => {
    if (!npi || npi === 0) return '---';
    return Math.floor(npi).toString();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black italic tracking-tight text-cyan-400 mb-2">
            KINETIX
          </h1>
          <p className="text-gray-400 text-sm">Intelligent Running Coach</p>
        </div>

        {/* NPI Showcase - The Star! */}
        <div className="mb-8">
          <div className="glass rounded-3xl p-8 border border-cyan-500/20 shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Normalized Performance Index
                </div>
                <div className="text-sm text-gray-300">
                  Your running efficiency score
                </div>
              </div>
              <Activity className="text-cyan-400" size={24} />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Best NPI */}
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Best
                </div>
                <div className="text-5xl font-black text-cyan-400 mb-1">
                  {formatNPI(bestNPI)}
                </div>
                <div className="text-xs text-gray-500">
                  {bestNPI ? 'All Time' : 'No runs yet'}
                </div>
              </div>

              {/* Average NPI */}
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Average
                </div>
                <div className="text-5xl font-black text-purple-400 mb-1">
                  {formatNPI(averageNPI)}
                </div>
                <div className="text-xs text-gray-500">
                  {averageNPI ? 'Overall' : 'No runs yet'}
                </div>
              </div>

              {/* Target NPI */}
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Target
                </div>
                <div className="text-5xl font-black text-orange-400 mb-1">
                  {settings ? Math.floor(settings.targetNPI) : '---'}
                </div>
                <div className="text-xs text-gray-500">Goal</div>
              </div>
            </div>

            {/* Progress indicator if we have data */}
            {bestNPI && settings && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400">
                    Progress to Target
                  </span>
                  <span className="text-xs font-bold text-cyan-400">
                    {Math.min(100, Math.floor((bestNPI / settings.targetNPI) * 100))}%
                  </span>
                </div>
                <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (bestNPI / settings.targetNPI) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={onStartRun}
            data-testid="home-start-run"
            className="glass rounded-2xl p-6 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 group"
          >
            <div className="flex items-center justify-between mb-2">
              <Play
                className="text-green-400 group-hover:scale-110 transition-transform"
                size={24}
              />
              <span className="text-xs font-bold text-green-400 uppercase tracking-wide">
                Start Run
              </span>
            </div>
            <div className="text-sm text-gray-300">Begin tracking</div>
          </button>

          <button
            onClick={() => onNavigate('history')}
            data-testid="home-history"
            className="glass rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 group"
          >
            <div className="flex items-center justify-between mb-2">
              <History
                className="text-purple-400 group-hover:scale-110 transition-transform"
                size={24}
              />
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">
                History
              </span>
            </div>
            <div className="text-sm text-gray-300">View past runs</div>
          </button>
        </div>

        {/* Recent Runs */}
        {recentRuns.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-cyan-400" />
              Recent Runs
            </h2>
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  onClick={() => onNavigate('run-detail', run.id)}
                  className="glass rounded-xl p-4 border border-white/10 hover:border-cyan-500/30 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white mb-1">
                        {formatDate(run.date)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(run.distance / 1000).toFixed(2)} km •{' '}
                        {Math.floor(run.duration / 60)}:
                        {Math.floor(run.duration % 60)
                          .toString()
                          .padStart(2, '0')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-cyan-400 group-hover:scale-110 transition-transform">
                        {Math.floor(run.avgNPI)}
                      </div>
                      <div className="text-xs text-gray-500 uppercase">NPI</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Link */}
        <button
          onClick={() => onNavigate('settings')}
          data-testid="home-settings"
          className="w-full glass rounded-xl p-4 border border-white/10 hover:border-orange-500/30 transition-all duration-300 flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <Settings
              className="text-orange-400 group-hover:rotate-90 transition-transform duration-500"
              size={20}
            />
            <span className="text-sm font-semibold text-white">Settings</span>
          </div>
          <span className="text-xs text-gray-400">→</span>
        </button>
      </div>
    </div>
  );
}
