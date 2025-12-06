import React, { useState, useEffect, useCallback } from 'react';
import { HomeView } from './components/HomeView';
import { RunView } from './components/RunView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { RunDetailView } from './components/RunDetailView';
import { PWAInstaller, PWAStatus } from './components/PWAInstaller';
import { unifiedStorageService } from './storage/sync/unifiedStorageService';
import { RAGIndexService } from './services/ragIndexService';

/**
 * Main App Component with routing
 */
export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [viewParams, setViewParams] = useState({});
  const [settings, setSettings] = useState(null);

  const loadSettings = useCallback(async () => {
    const loaded = await unifiedStorageService.getSettings();
    setSettings(loaded);
  }, []);

  const initializeStorage = useCallback(async () => {
    await unifiedStorageService.initialize();
    await loadSettings();
  }, [loadSettings]);

  const navigate = useCallback((view, params = {}) => {
    setCurrentView(view);
    setViewParams(params);
  }, []);

  useEffect(() => {
    initializeStorage();
    const path = window.location.pathname;
    if (path.includes('/oauth/strava/callback')) {
      navigate('oauth', { provider: 'strava' });
    }
  }, [initializeStorage, navigate]);

  const saveSettings = async (newSettings) => {
    await unifiedStorageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleStartRun = () => {
    navigate('run');
  };

  const handleSaveRun = async (run) => {
    // Index run in RAG service (if available)
    try {
      await RAGIndexService.indexRun(run);
    } catch (error) {
      // Silent fail - RAG is optional
      console.warn('Failed to index run in RAG:', error);
    }
    navigate('home');
  };

  const handleCancelRun = () => {
    navigate('home');
  };

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return (
          <HomeView
            onNavigate={navigate}
            onStartRun={handleStartRun}
          />
        );
      case 'run':
        return (
          <RunView
            settings={settings}
            onSave={handleSaveRun}
            onCancel={handleCancelRun}
          />
        );
      case 'history':
        return (
          <HistoryView
            onNavigate={navigate}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            onSave={saveSettings}
            onNavigate={navigate}
          />
        );
      case 'oauth':
        // Handle OAuth callbacks
        if (viewParams.provider === 'strava') {
          // This will be handled by SettingsView useEffect
          navigate('settings');
        }
        return null;
      case 'run-detail':
        return (
          <RunDetailView
            runId={viewParams.runId || viewParams}
            onNavigate={navigate}
          />
        );
      default:
        return <HomeView onNavigate={navigate} onStartRun={handleStartRun} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      <PWAStatus />
      {renderView()}
      <PWAInstaller />
    </div>
  );
}
