import React, { useState } from 'react';
import { ArrowLeft, Target, Globe, Heart, Calculator, Trash2, Database } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { calculateNPIFromRace } from '../utils/npiCalculator';
import { RAGIndexer } from './RAGIndexer';

/**
 * Settings view
 */
export function SettingsView({ settings, onSave, onNavigate }) {
  const [targetNPI, setTargetNPI] = useState(settings?.targetNPI || 135);
  const [unitSystem, setUnitSystem] = useState(settings?.unitSystem || 'metric');
  const [physioMode, setPhysioMode] = useState(settings?.physioMode || false);
  const [showFindTarget, setShowFindTarget] = useState(false);
  const [findDistance, setFindDistance] = useState('');
  const [findTime, setFindTime] = useState('');
  const [findUnit, setFindUnit] = useState('metric');
  const [showRAGIndexer, setShowRAGIndexer] = useState(false);

  const handleSave = () => {
    onSave({
      targetNPI,
      unitSystem,
      physioMode,
    });
    onNavigate('home');
  };

  const handleFindTarget = () => {
    if (!findDistance || !findTime) {
      alert('Please fill in distance and time');
      return;
    }

    try {
      const calculated = calculateNPIFromRace(
        parseFloat(findDistance),
        findTime,
        findUnit
      );
      setTargetNPI(calculated);
      setShowFindTarget(false);
      setFindDistance('');
      setFindTime('');
    } catch (error) {
      alert('Invalid input. Please check your distance and time format.');
    }
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to delete all runs? This cannot be undone.')) {
      await StorageService.clearAll();
      alert('All data cleared. Refreshing...');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => onNavigate('home')}
            className="glass rounded-xl p-3 border border-white/10 hover:border-orange-500/30 transition-all"
          >
            <ArrowLeft className="text-orange-400" size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tight text-orange-400">
              SETTINGS
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Target NPI */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-cyan-400" size={20} />
              <h2 className="text-lg font-bold text-white">Target NPI</h2>
            </div>
            <div className="mb-4">
              <div className="text-5xl font-black text-cyan-400 mb-2">
                {Math.round(targetNPI)}
              </div>
              <p className="text-sm text-gray-400">
                Your goal Normalized Performance Index
              </p>
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTargetNPI((n) => Math.max(0, n - 5))}
                className="flex-1 py-3 bg-gray-900/50 rounded-xl text-gray-300 font-bold hover:bg-gray-800 border border-gray-700/50 transition-all"
              >
                -5
              </button>
              <button
                onClick={() => setTargetNPI((n) => Math.max(0, n - 1))}
                className="flex-1 py-3 bg-gray-900/50 rounded-xl text-gray-300 font-bold hover:bg-gray-800 border border-gray-700/50 transition-all"
              >
                -1
              </button>
              <button
                onClick={() => setTargetNPI((n) => n + 1)}
                className="flex-1 py-3 bg-gray-900/50 rounded-xl text-gray-300 font-bold hover:bg-gray-800 border border-gray-700/50 transition-all"
              >
                +1
              </button>
              <button
                onClick={() => setTargetNPI((n) => n + 5)}
                className="flex-1 py-3 bg-gray-900/50 rounded-xl text-gray-300 font-bold hover:bg-gray-800 border border-gray-700/50 transition-all"
              >
                +5
              </button>
            </div>
            <button
              onClick={() => setShowFindTarget(true)}
              className="w-full py-3 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 hover:from-cyan-500/30 hover:to-cyan-600/30 border border-cyan-500/30 rounded-xl text-cyan-400 font-bold transition-all flex items-center justify-center gap-2"
            >
              <Calculator size={16} />
              Find My Target NPI
            </button>
          </div>

          {/* Unit System */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="text-purple-400" size={20} />
              <h2 className="text-lg font-bold text-white">Unit System</h2>
            </div>
            <select
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value)}
              className="w-full bg-gray-900/50 text-white p-4 rounded-xl border border-gray-700/50 focus:border-purple-500/50 focus:outline-none"
            >
              <option value="metric">Metric (km, km/h)</option>
              <option value="imperial">Imperial (mi, mph)</option>
            </select>
          </div>

          {/* Physio Mode */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Heart className="text-red-400" size={20} />
                <div>
                  <h2 className="text-lg font-bold text-white">Physio-Pacer</h2>
                  <p className="text-sm text-gray-400">
                    Monitor heart rate for cardiac drift
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPhysioMode(!physioMode)}
                className={`w-14 h-8 rounded-full transition-all relative ${
                  physioMode
                    ? 'bg-gradient-to-r from-green-500 to-green-600'
                    : 'bg-gray-800'
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${
                    physioMode ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* RAG Indexing */}
          <div className="glass rounded-2xl p-6 border border-cyan-500/20">
            <div className="flex items-center gap-3 mb-4">
              <Database className="text-cyan-400" size={20} />
              <h2 className="text-lg font-bold text-white">RAG Indexing</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Index your runs to enable AI analysis with historical context from your past runs.
            </p>
            <button
              onClick={() => setShowRAGIndexer(true)}
              className="w-full py-3 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 hover:from-cyan-500/30 hover:to-cyan-600/30 border border-cyan-500/30 rounded-xl text-cyan-400 font-bold transition-all flex items-center justify-center gap-2"
            >
              <Database size={16} />
              Index Runs for RAG
            </button>
          </div>

          {/* Danger Zone */}
          <div className="glass rounded-2xl p-6 border border-red-500/20">
            <h2 className="text-lg font-bold text-red-400 mb-4">Danger Zone</h2>
            <button
              onClick={handleClearData}
              className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 font-bold transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Clear All Data
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl text-white font-bold shadow-lg transition-all"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* Find Target Modal */}
      {showFindTarget && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className="glass border border-cyan-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black text-cyan-400 mb-4 text-center">
              Find My Target NPI
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">
                  Distance
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={findDistance}
                    onChange={(e) => setFindDistance(e.target.value)}
                    placeholder="5.0"
                    className="flex-1 bg-gray-900/50 text-white p-3 rounded-xl border border-gray-700/50 focus:border-cyan-500/50 focus:outline-none"
                  />
                  <select
                    value={findUnit}
                    onChange={(e) => setFindUnit(e.target.value)}
                    className="bg-gray-900/50 text-white p-3 rounded-xl border border-gray-700/50 focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="metric">km</option>
                    <option value="imperial">mi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">
                  Time (MM:SS)
                </label>
                <input
                  type="text"
                  value={findTime}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d:]/g, '');
                    if (val.length <= 5 && /^\d{0,2}:?\d{0,2}$/.test(val)) {
                      setFindTime(val);
                    }
                  }}
                  placeholder="20:00"
                  className="w-full bg-gray-900/50 text-white p-3 rounded-xl border border-gray-700/50 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFindTarget(false)}
                className="flex-1 py-3 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-gray-300 font-bold border border-gray-700/50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleFindTarget}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl text-white font-bold shadow-lg transition-all"
              >
                Calculate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RAG Indexer Modal */}
      {showRAGIndexer && (
        <RAGIndexer onClose={() => setShowRAGIndexer(false)} />
      )}
    </div>
  );
}

