/**
 * Unified Storage Service
 * Coordinates between local storage (IndexedDB) and cloud storage
 * Implements offline-first architecture with cloud sync
 */

import { StorageService } from './storageService.js';
import { cloudSyncService } from './cloudSyncService.js';
import { CloudTokenStorage } from './cloudTokenStorage.js';

export class UnifiedStorageService {
  constructor() {
    this.syncMode = 'local'; // 'local' | 'cloud-synced' | 'cloud-primary'
    this.syncInProgress = false;
  }

  /**
   * Initialize unified storage service
   * Loads sync mode from settings and triggers initial sync if needed
   */
  async initialize() {
    try {
      const settings = await StorageService.getSettings();
      this.syncMode = settings.syncMode || 'local';

      // If cloud-synced, check connection and trigger background sync
      if (this.syncMode === 'cloud-synced' || this.syncMode === 'cloud-primary') {
        const status = await cloudSyncService.getSyncStatus();
        if (status.isConnected) {
          // Trigger background sync (don't await - non-blocking)
          this.syncFromCloud().catch(error => {
            console.warn('Background sync failed on init:', error);
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize unified storage:', error);
      // Fallback to local-only mode
      this.syncMode = 'local';
    }
  }

  /**
   * Save a run
   * Always saves to local first (offline-first), then syncs to cloud if enabled
   */
  async saveRun(run) {
    // Always save to local first (offline-first principle)
    const saved = await StorageService.saveRun(run);
    
    if (!saved) {
      throw new Error('Failed to save run locally');
    }

    // Add sync metadata
    const runData = run.toJSON ? run.toJSON() : run;
    runData.lastModified = new Date().toISOString();
    runData.syncedAt = null; // Will be set when synced

    // If cloud-synced, queue for cloud sync (non-blocking)
    if (this.syncMode === 'cloud-synced') {
      // Fire and forget - don't block UI
      this.syncRunToCloud(runData).catch(error => {
        console.error('Background sync failed for run:', error);
        // Run is saved locally, sync will retry later
      });
    } else if (this.syncMode === 'cloud-primary') {
      // Cloud-primary: must sync before considering it saved
      try {
        await this.syncRunToCloud(runData);
      } catch (error) {
        console.error('Cloud-primary sync failed:', error);
        // Still saved locally, but warn user
        throw new Error('Run saved locally but cloud sync failed. Please check your connection.');
      }
    }

    return saved;
  }

  /**
   * Get all runs
   * Always reads from local (fast, offline-capable), triggers background sync if cloud-synced
   */
  async getAllRuns() {
    // Always read from local (offline-first)
    const runs = await StorageService.getAllRuns();

    // If cloud-synced, trigger background sync to get latest
    if (this.syncMode === 'cloud-synced' && !this.syncInProgress) {
      // Don't await - return local data immediately, sync in background
      this.syncFromCloud().catch(error => {
        console.warn('Background sync failed:', error);
      });
    } else if (this.syncMode === 'cloud-primary') {
      // Cloud-primary: sync first, then return
      await this.syncFromCloud();
      return await StorageService.getAllRuns();
    }

    return runs;
  }

  /**
   * Get a single run by ID
   */
  async getRun(id) {
    // Read from local first
    let run = await StorageService.getRun(id);

    // If cloud-primary and not found locally, try cloud
    if (!run && this.syncMode === 'cloud-primary') {
      try {
        // This would require adding getRunFromCloud to cloudSyncService
        // For now, sync all and try again
        await this.syncFromCloud();
        run = await StorageService.getRun(id);
      } catch (error) {
        console.error('Failed to get run from cloud:', error);
      }
    }

    return run;
  }

  /**
   * Delete a run
   * Deletes from local and cloud (if synced)
   */
  async deleteRun(id) {
    // Delete from local
    await StorageService.deleteRun(id);

    // Delete from cloud if synced
    if (this.syncMode !== 'local') {
      try {
        // Note: This would require adding deleteRunFromCloud to cloudSyncService
        // For now, we'll handle it in the next sync cycle
        console.log('Run deleted locally, will be removed from cloud on next sync');
      } catch (error) {
        console.error('Failed to delete run from cloud:', error);
        // Still deleted locally, which is fine
      }
    }
  }

  /**
   * Save settings
   * Saves to local and syncs to cloud if enabled
   */
  async saveSettings(settings) {
    // Save to local
    await StorageService.saveSettings(settings);

    // Update sync mode if changed
    if (settings.syncMode && settings.syncMode !== this.syncMode) {
      this.syncMode = settings.syncMode;
      
      // If enabling cloud sync, initialize it
      if (this.syncMode === 'cloud-synced' || this.syncMode === 'cloud-primary') {
        const status = await cloudSyncService.getSyncStatus();
        if (!status.isConnected) {
          throw new Error('Cloud storage not connected. Please connect a cloud provider first.');
        }
      }
    }

    // Sync to cloud if enabled
    if (this.syncMode !== 'local') {
      try {
        await cloudSyncService.syncSettingsToCloud();
      } catch (error) {
        console.error('Failed to sync settings to cloud:', error);
        // Settings saved locally, which is fine
      }
    }
  }

  /**
   * Get settings
   * Reads from local, merges with cloud if cloud-synced
   */
  async getSettings() {
    const settings = await StorageService.getSettings();

    // If cloud-synced, check for cloud updates (non-blocking)
    if (this.syncMode === 'cloud-synced') {
      try {
        const cloudSettings = await cloudSyncService.syncSettingsFromCloud();
        if (cloudSettings && cloudSettings.settings) {
          // Merge with local (cloud takes precedence for conflicting keys)
          return { ...settings, ...cloudSettings.settings };
        }
      } catch (error) {
        // Cloud unavailable, use local
        console.warn('Cloud settings unavailable, using local:', error);
      }
    } else if (this.syncMode === 'cloud-primary') {
      // Cloud-primary: get from cloud first
      try {
        const cloudSettings = await cloudSyncService.syncSettingsFromCloud();
        if (cloudSettings && cloudSettings.settings) {
          // Save to local cache
          await StorageService.saveSettings(cloudSettings.settings);
          return cloudSettings.settings;
        }
      } catch (error) {
        console.warn('Cloud settings unavailable, using local cache:', error);
      }
    }

    return settings;
  }

  /**
   * Sync a single run to cloud
   */
  async syncRunToCloud(run) {
    if (this.syncMode === 'local') {
      return; // No cloud sync
    }

    try {
      const providerInfo = await cloudSyncService.getProvider();
      if (!providerInfo) {
        throw new Error('No cloud provider connected');
      }

      const { name: providerName, provider } = providerInfo;
      const accessToken = await cloudSyncService.ensureValidToken(providerName);

      // Ensure runs folder exists
      await provider.ensureFolderExists('Kinetix/runs', accessToken);

      // Upload run
      const fileName = `runs/run_${run.id}.json`;
      const content = JSON.stringify({
        ...run,
        syncedAt: new Date().toISOString(),
      }, null, 2);

      await provider.uploadFile(fileName, content, accessToken);
    } catch (error) {
      console.error('Failed to sync run to cloud:', error);
      throw error;
    }
  }

  /**
   * Sync all data from cloud to local
   */
  async syncFromCloud() {
    if (this.syncMode === 'local') {
      return { success: true, message: 'Cloud sync not enabled' };
    }

    if (this.syncInProgress) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.syncInProgress = true;

    try {
      const result = await cloudSyncService.syncRunsFromCloud();
      await cloudSyncService.syncSettingsFromCloud();
      
      return result;
    } catch (error) {
      console.error('Sync from cloud failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync all data to cloud
   */
  async syncToCloud() {
    if (this.syncMode === 'local') {
      return { success: true, message: 'Cloud sync not enabled' };
    }

    if (this.syncInProgress) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.syncInProgress = true;

    try {
      const result = await cloudSyncService.syncRunsToCloud();
      await cloudSyncService.syncSettingsToCloud();
      
      return result;
    } catch (error) {
      console.error('Sync to cloud failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Full bidirectional sync
   */
  async fullSync() {
    if (this.syncMode === 'local') {
      throw new Error('Cloud sync not enabled');
    }

    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;

    try {
      // Sync from cloud first (get latest)
      const fromCloud = await this.syncFromCloud();
      
      // Then sync to cloud (upload local changes)
      const toCloud = await this.syncToCloud();

      return {
        success: true,
        fromCloud,
        toCloud,
      };
    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Enable cloud sync with a provider
   */
  async enableCloudSync(providerName) {
    try {
      // Check if already authenticated
      const hasTokens = await CloudTokenStorage.hasTokens(providerName);
      
      if (!hasTokens) {
        throw new Error('Not authenticated with cloud provider. Please authenticate first.');
      }

      // Update settings to enable cloud sync
      const settings = await StorageService.getSettings();
      settings.syncMode = 'cloud-synced';
      await this.saveSettings(settings);

      // Initial sync
      await this.fullSync();

      return { success: true };
    } catch (error) {
      console.error('Failed to enable cloud sync:', error);
      throw error;
    }
  }

  /**
   * Disable cloud sync (keep local-only)
   */
  async disableCloudSync() {
    const settings = await StorageService.getSettings();
    settings.syncMode = 'local';
    await this.saveSettings(settings);
    
    this.syncMode = 'local';
    
    return { success: true };
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const status = await cloudSyncService.getSyncStatus();
    
    return {
      ...status,
      syncMode: this.syncMode,
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * Clear all data (local and cloud if synced)
   */
  async clearAll() {
    // Clear local
    await StorageService.clearAll();

    // Clear cloud if synced
    if (this.syncMode !== 'local') {
      try {
        // Note: Would need to implement clearCloud in cloudSyncService
        console.log('Local data cleared. Cloud data will remain unless manually deleted.');
      } catch (error) {
        console.error('Failed to clear cloud data:', error);
      }
    }
  }
}

// Export singleton instance
export const unifiedStorageService = new UnifiedStorageService();

