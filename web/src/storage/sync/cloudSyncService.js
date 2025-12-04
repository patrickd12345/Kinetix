import { GoogleDriveProvider } from '../providers/googleDriveProvider.js';
import { CloudTokenStorage } from '../providers/cloudTokenStorage.js';
import { StorageService } from '../local/storageService.js';

/**
 * Cloud sync service - handles syncing data between local storage and cloud
 * Uses single file architecture: kinetix-data.json
 */
const DATA_FILENAME = 'kinetix-data.json';

export class CloudSyncService {
  constructor() {
    this.providers = {
      google: new GoogleDriveProvider(),
    };
    this.syncInProgress = false;
    this.lastSyncTime = null;
  }

  /**
   * Get current provider instance
   */
  async getProvider() {
    // Check which provider is connected
    for (const [name, provider] of Object.entries(this.providers)) {
      if (await CloudTokenStorage.hasTokens(name)) {
        return { name, provider };
      }
    }
    return null;
  }

  /**
   * Ensure we have a valid access token
   */
  async ensureValidToken(providerName) {
    const isValid = await CloudTokenStorage.isTokenValid(providerName);
    
    if (isValid) {
      const tokens = await CloudTokenStorage.getTokens(providerName);
      return tokens.accessToken;
    }

    // Token expired or expiring soon, refresh it
    const tokens = await CloudTokenStorage.getTokens(providerName);
    if (!tokens || !tokens.refreshToken) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    const provider = this.providers[providerName];
    const refreshed = await provider.refreshAccessToken(tokens.refreshToken);
    
    await CloudTokenStorage.updateAccessToken(
      providerName,
      refreshed.accessToken,
      refreshed.expiresIn
    );

    return refreshed.accessToken;
  }

  /**
   * Load all data from cloud (single file)
   */
  async loadDataFromCloud(accessToken) {
    const providerInfo = await this.getProvider();
    if (!providerInfo) {
      throw new Error('No provider connected');
    }

    const { provider } = providerInfo;

    try {
      const content = await provider.downloadFile(DATA_FILENAME, accessToken);
      return JSON.parse(content);
    } catch (error) {
      if (error.message.includes('not found')) {
        // File doesn't exist yet, return empty structure
        return {
          runs: [],
          settings: {},
          syncMetadata: {
            lastSync: null,
            deviceId: null,
            syncVersion: 1,
          },
        };
      }
      throw error;
    }
  }

  /**
   * Save all data to cloud (single file)
   */
  async saveDataToCloud(data, accessToken) {
    const providerInfo = await this.getProvider();
    if (!providerInfo) {
      throw new Error('No provider connected');
    }

    const { provider } = providerInfo;
    const content = JSON.stringify(data, null, 2);
    await provider.uploadFile(DATA_FILENAME, content, accessToken);
  }

  /**
   * Sync all runs to cloud (using single file)
   */
  async syncRunsToCloud() {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;

    try {
      const providerInfo = await this.getProvider();
      if (!providerInfo) {
        throw new Error('No cloud storage provider connected');
      }

      const { name: providerName, provider } = providerInfo;
      const accessToken = await this.ensureValidToken(providerName);

      // Get local data
      const localRuns = await StorageService.getAllRuns();
      const localSettings = await StorageService.getSettings();

      // Load cloud data (if exists)
      const cloudData = await this.loadDataFromCloud(accessToken);

      // Merge: Local is source of truth for runs
      const mergedData = {
        runs: localRuns.map(run => ({
          ...run,
          lastModified: run.lastModified || new Date(run.date).toISOString(),
          syncedAt: new Date().toISOString(),
        })),
        settings: localSettings,
        syncMetadata: {
          ...cloudData.syncMetadata,
          lastSync: new Date().toISOString(),
          deviceId: localStorage.getItem('kinetix_device_id') || 'unknown',
          syncVersion: 1,
        },
      };

      // Save merged data to cloud
      await this.saveDataToCloud(mergedData, accessToken);

      this.lastSyncTime = Date.now();
      return { 
        success: true, 
        uploaded: localRuns.length, 
        total: localRuns.length 
      };
    } catch (error) {
      console.error('Sync to cloud failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync runs from cloud to local (using single file)
   */
  async syncRunsFromCloud() {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;

    try {
      const providerInfo = await this.getProvider();
      if (!providerInfo) {
        throw new Error('No cloud storage provider connected');
      }

      const { name: providerName, provider } = providerInfo;
      const accessToken = await this.ensureValidToken(providerName);

      // Load cloud data
      const cloudData = await this.loadDataFromCloud(accessToken);

      // Get local data
      const localRuns = await StorageService.getAllRuns();
      const localRunMap = new Map(localRuns.map(r => [r.id, r]));

      // Merge runs: last-write-wins
      let downloaded = 0;
      let merged = 0;

      for (const cloudRun of cloudData.runs || []) {
        const localRun = localRunMap.get(cloudRun.id);
        
        if (!localRun) {
          // New run from cloud
          await StorageService.saveRun(cloudRun);
          downloaded++;
        } else {
          // Both exist - compare timestamps
          const localModified = new Date(localRun.lastModified || localRun.date || 0);
          const cloudModified = new Date(cloudRun.lastModified || cloudRun.date || 0);
          const cloudSyncedAt = new Date(cloudRun.syncedAt || 0);
          
          // Use cloud if it's newer
          if (cloudSyncedAt > localModified || cloudModified > localModified) {
            await StorageService.saveRun(cloudRun);
            merged++;
          }
        }
      }

      // Merge settings (cloud takes precedence for conflicts)
      if (cloudData.settings) {
        const localSettings = await StorageService.getSettings();
        const mergedSettings = { ...localSettings, ...cloudData.settings };
        await StorageService.saveSettings(mergedSettings);
      }

      this.lastSyncTime = Date.now();
      return { 
        success: true, 
        downloaded, 
        merged, 
        total: cloudData.runs?.length || 0 
      };
    } catch (error) {
      console.error('Sync from cloud failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync settings to cloud (now part of single file)
   */
  async syncSettingsToCloud() {
    // Settings are now part of the main data file
    // This method is kept for API compatibility but calls syncRunsToCloud
    return await this.syncRunsToCloud();
  }

  /**
   * Sync settings from cloud (now part of single file)
   */
  async syncSettingsFromCloud() {
    // Settings are now part of the main data file
    // This method is kept for API compatibility but calls syncRunsFromCloud
    const result = await this.syncRunsFromCloud();
    return { success: true, settings: await StorageService.getSettings() };
  }

  /**
   * Full sync (both directions)
   */
  async fullSync() {
    try {
      // Sync from cloud first (get latest)
      const fromCloud = await this.syncRunsFromCloud();
      await this.syncSettingsFromCloud();
      
      // Then sync to cloud (upload local changes)
      const toCloud = await this.syncRunsToCloud();
      await this.syncSettingsToCloud();
      
      return {
        success: true,
        fromCloud,
        toCloud,
      };
    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    }
  }

  // Note: updateSyncMetadata removed - metadata is now part of main data file

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const providerInfo = await this.getProvider();
    const isConnected = providerInfo !== null;
    const isSyncing = this.syncInProgress;

    return {
      isConnected,
      isSyncing,
      provider: providerInfo?.name || null,
      lastSyncTime: this.lastSyncTime,
    };
  }
}

// Export singleton instance
export const cloudSyncService = new CloudSyncService();

