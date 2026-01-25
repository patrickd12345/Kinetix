import React, { useState, useEffect } from 'react';
import { Download, X, Check } from 'lucide-react';

/**
 * PWA Install Prompt Component
 * Shows install button when PWA can be installed
 */
export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was just installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if dismissed this session or already installed
  if (isInstalled || !showPrompt || sessionStorage.getItem('pwa-install-dismissed')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className="glass rounded-2xl p-4 border border-cyan-500/30 shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Download className="text-cyan-400" size={18} />
              Install Kinetix
            </h3>
            <p className="text-xs text-gray-400">
              Install as an app for quick access and better experience
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl text-white text-sm font-bold shadow-lg transition-all"
          >
            Install Now
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-gray-300 text-sm font-semibold border border-gray-700/50 transition-all"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Install Status Indicator (for installed PWAs)
 */
export function PWAStatus() {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
  }, []);

  if (!isInstalled) return null;

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="glass rounded-xl px-3 py-2 border border-green-500/30 flex items-center gap-2">
        <Check className="text-green-400" size={14} />
        <span className="text-xs font-semibold text-green-400">Installed</span>
      </div>
    </div>
  );
}









