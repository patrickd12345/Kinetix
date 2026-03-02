import React, { useState, useEffect } from 'react';
import { ArrowLeft, Target, Globe, Heart, Calculator, Trash2, Database, Download, Cloud, Activity } from 'lucide-react';
import { unifiedStorageService } from '../storage/sync/unifiedStorageService';
import { calculateNPIFromRace } from '../utils/npiCalculator';
import { RAGIndexer } from './RAGIndexer';
import { stravaService } from '../services/stravaService';
import { cloudSyncService } from '../storage/sync/cloudSyncService';
import { StorageService } from '../storage/local/storageService';
import { Run } from '../models/Run';
import { supabaseSyncService } from '../services/supabaseSyncService';

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
  
  // Strava states
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [stravaExporting, setStravaExporting] = useState(false);
  const [showStravaExport, setShowStravaExport] = useState(false);
  const [stravaDays, setStravaDays] = useState(90);
  const [stravaImportDays, setStravaImportDays] = useState(180);
  const [stravaImporting, setStravaImporting] = useState(false);
  const [stravaImportStatus, setStravaImportStatus] = useState('');
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const supabaseReady = supabaseSyncService.isConfigured();
  
  // Check Strava connection on mount
  useEffect(() => {
    const tokens = stravaService.getStoredTokens();
    setIsStravaConnected(tokens !== null);
    supabaseSyncService.getUser().then(setSupabaseUser).catch(() => setSupabaseUser(null));
  }, []);

  const handleStravaCallback = async (code) => {
    try {
      if (!stravaService.clientId || !stravaService.clientSecret) {
        alert('Strava integration is not configured. Please contact the developer.');
        return;
      }
      
      const tokens = await stravaService.exchangeCodeForToken(code);
      stravaService.storeTokens(tokens);
      setIsStravaConnected(true);
      alert('✅ Connected to Strava! Your runs will now sync automatically.');
    } catch (error) {
      alert(`Failed to connect Strava: ${error.message}`);
    }
  };

  // Check for OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code && (window.location.pathname.includes('/oauth/strava/callback') || window.location.search.includes('code='))) {
      handleStravaCallback(code);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  const handleConnectStrava = async () => {
    try {
      if (!stravaService.clientId || !stravaService.clientSecret) {
        alert('Strava integration is not configured. Please contact the developer.');
        return;
      }
      
      const authUrl = stravaService.getAuthorizationUrl();
      window.location.href = authUrl;
    } catch (error) {
      alert(`Failed to connect Strava: ${error.message}`);
    }
  };

  const handleDisconnectStrava = async () => {
    if (confirm('Disconnect Strava? Your runs will no longer sync automatically.')) {
      stravaService.clearTokens();
      setIsStravaConnected(false);
    }
  };

  const handleStravaExport = async () => {
    try {
      setStravaExporting(true);
      
      const tokens = stravaService.getStoredTokens();
      if (!tokens) {
        alert('Please connect Strava first');
        setShowStravaExport(false);
        return;
      }

      const cloudStatus = await cloudSyncService.getSyncStatus();
      if (!cloudStatus.isConnected) {
        alert('Please connect Google Drive first in Cloud Storage settings');
        setShowStravaExport(false);
        return;
      }

      const accessToken = await stravaService.getValidAccessToken();
      const activities = await stravaService.fetchActivities(accessToken, stravaDays);
      const runs = stravaService.convertToRuns(activities);

      if (runs.length === 0) {
        alert(`No runs found in the last ${stravaDays} days`);
        setShowStravaExport(false);
        setStravaExporting(false);
        return;
      }

      const jsonData = JSON.stringify(runs, null, 2);
      const filename = `strava-runs-last-${stravaDays}-days-${new Date().toISOString().split('T')[0]}.json`;

      const providerInfo = await cloudSyncService.getProvider();
      if (!providerInfo) {
        throw new Error('Google Drive not connected');
      }

      const { provider } = providerInfo;
      const googleToken = await cloudSyncService.ensureValidToken('google');

      await provider.ensureFolderExists('Kinetix', googleToken);
      await provider.uploadFile(`Kinetix/${filename}`, jsonData, googleToken);

      alert(`✅ Successfully exported ${runs.length} runs to Google Drive!`);
      setShowStravaExport(false);
    } catch (error) {
      console.error('Strava export failed:', error);
      alert(`Failed to export: ${error.message}`);
    } finally {
      setStravaExporting(false);
    }
  };

  const handleSupabaseSignIn = async () => {
    try {
      await supabaseSyncService.signInWithGoogle();
    } catch (error) {
      alert(`Supabase sign-in failed: ${error.message}`);
    }
  };

  const handleSupabaseSignOut = async () => {
    await supabaseSyncService.signOut();
    setSupabaseUser(null);
  };

  const handleSupabaseSync = async () => {
    setSupabaseSyncing(true);
    try {
      const user = await supabaseSyncService.getUser();
      setSupabaseUser(user);
      if (!user) {
        alert('Please connect Supabase first.');
        return;
      }
      const pushed = await supabaseSyncService.pushRuns();
      const pulled = await supabaseSyncService.pullRuns();
      alert(`Sync complete: pushed ${pushed}, pulled ${pulled}`);
    } catch (error) {
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSupabaseSyncing(false);
    }
  };

  const handleStravaImport = async () => {
    try {
      setStravaImporting(true);
      setStravaImportStatus('');

      const tokens = stravaService.getStoredTokens();
      if (!tokens) {
        alert('Please connect Strava first');
        return;
      }

      const accessToken = await stravaService.getValidAccessToken();
      const activities = await stravaService.fetchActivities(accessToken, stravaImportDays);
      const runs = stravaService.convertToRuns(activities);

      if (!runs.length) {
        setStravaImportStatus(`No runs found in the last ${stravaImportDays} days`);
        return;
      }

      let imported = 0;
      for (const runData of runs) {
        const run = Run.fromJSON ? Run.fromJSON(runData) : new Run(runData);
        const saved = await StorageService.saveRun(run);
        if (saved) imported++;
      }

      setStravaImportStatus(`✅ Imported ${imported} runs from the last ${stravaImportDays} days`);
    } catch (error) {
      console.error('Strava import failed:', error);
      setStravaImportStatus(`❌ Failed to import: ${error.message}`);
    } finally {
      setStravaImporting(false);
    }
  };

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
      await unifiedStorageService.clearAll();
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
            data-testid="settings-back"
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

          {/* Strava Integration */}
          <div className="glass rounded-2xl p-6 border border-orange-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="text-orange-400" size={20} />
            <h2 className="text-lg font-bold text-white">Strava</h2>
          </div>

          {/* Supabase Sync */}
          <div className="glass rounded-2xl p-6 border border-green-500/20">
            <div className="flex items-center gap-3 mb-4">
              <Database className="text-green-400" size={20} />
              <h2 className="text-lg font-bold text-white">Cloud Sync (Supabase)</h2>
            </div>
            {!supabaseReady ? (
              <p className="text-sm text-gray-400">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable.</p>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-3">
                  {supabaseUser
                    ? `Connected as ${supabaseUser.email || supabaseUser.id}`
                    : 'Sign in to sync runs across devices.'}
                </p>
                <div className="flex gap-3 mb-3">
                  {!supabaseUser ? (
                    <button
                      onClick={handleSupabaseSignIn}
                      className="flex-1 py-3 bg-gradient-to-r from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30 border border-green-500/30 rounded-xl text-green-300 font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Database size={16} />
                      Connect Supabase
                    </button>
                  ) : (
                    <button
                      onClick={handleSupabaseSignOut}
                      className="py-3 px-4 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-gray-300 font-bold border border-gray-700/50 transition-all"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    onClick={handleSupabaseSync}
                    disabled={!supabaseUser || supabaseSyncing}
                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 rounded-xl text-white font-bold shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {supabaseSyncing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Sync now
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Uploads local runs (upsert) and pulls cloud runs using last-write-wins on updated_at.
                </p>
              </>
            )}
          </div>
          <p className="text-sm text-gray-400 mb-4">
            {isStravaConnected 
              ? 'Connected to Strava. Your runs are automatically synced.'
              : 'Connect Strava to automatically sync your runs and export historical data.'}
          </p>
            {!isStravaConnected ? (
              <button
                onClick={handleConnectStrava}
                className="w-full py-3 bg-gradient-to-r from-orange-500/20 to-orange-600/20 hover:from-orange-500/30 hover:to-orange-600/30 border border-orange-500/30 rounded-xl text-orange-400 font-bold transition-all flex items-center justify-center gap-2"
              >
                <Activity size={16} />
                Connect Strava
              </button>
            ) : (
              <div className="space-y-3">
                <div className="glass rounded-xl p-4 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">Import Strava runs</div>
                      <div className="text-xs text-gray-400">Pull historical runs directly into Kinetix</div>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={stravaImportDays}
                      onChange={(e) => setStravaImportDays(Number(e.target.value) || 1)}
                      className="w-20 bg-gray-900/50 text-white p-2 rounded-lg border border-gray-700/50 focus:border-orange-500/50 focus:outline-none text-sm"
                      aria-label="Strava import days"
                    />
                  </div>
                  <button
                    onClick={handleStravaImport}
                    disabled={stravaImporting}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-xl text-white font-bold shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {stravaImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Import last {stravaImportDays} days
                      </>
                    )}
                  </button>
                  {stravaImportStatus && (
                    <div className="text-xs text-gray-300">
                      {stravaImportStatus}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setShowStravaExport(true)}
                    disabled={stravaExporting}
                    className="w-full py-3 bg-gradient-to-r from-orange-500/20 to-orange-600/20 hover:from-orange-500/30 hover:to-orange-600/30 border border-orange-500/30 rounded-xl text-orange-400 font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Download size={16} />
                    {stravaExporting ? 'Exporting...' : 'Export to Google Drive'}
                  </button>
                  <button
                    onClick={handleDisconnectStrava}
                    className="w-full py-2 bg-gray-900/50 hover:bg-gray-800 border border-gray-700/50 rounded-xl text-gray-300 font-bold transition-all text-sm"
                  >
                    Disconnect Strava
                  </button>
                </div>
              </div>
            )}
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

      {/* Strava Export Modal */}
      {showStravaExport && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className="glass border border-orange-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black text-orange-400 mb-4 text-center">
              Export Strava Runs to Google Drive
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">
                  Number of Days (default: 90)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={stravaDays}
                  onChange={(e) => setStravaDays(parseInt(e.target.value) || 90)}
                  className="w-full bg-gray-900/50 text-white p-3 rounded-xl border border-gray-700/50 focus:border-orange-500/50 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Export runs from the last {stravaDays} days
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStravaExport(false)}
                disabled={stravaExporting}
                className="flex-1 py-3 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-gray-300 font-bold border border-gray-700/50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStravaExport}
                disabled={stravaExporting}
                className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-xl text-white font-bold shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {stravaExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Cloud size={16} />
                    Export
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
