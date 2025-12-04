import { GoogleDriveProvider } from './googleDriveProvider.js';
import { CloudTokenStorage } from './cloudTokenStorage.js';
import { StorageService } from './storageService.js';

/**
 * Cloud sync service - handles syncing data between local storage and cloud
 */
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
   * Sync all runs to cloud
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

      // Get all local runs
      const runs = await StorageService.getAllRuns();

      // Ensure runs folder exists
      await provider.ensureFolderExists('Kinetix/runs', accessToken);

      // Upload each run
      let uploaded = 0;
      for (const run of runs) {
        const fileName = `runs/run_${run.id}.json`;
        const content = JSON.stringify(run, null, 2);
        
        try {
          await provider.uploadFile(fileName, content, accessToken);
          uploaded++;
        } catch (error) {
          console.error(`Failed to upload run ${run.id}:`, error);
          // Continue with other runs
        }
      }

      // Update sync metadata
      await this.updateSyncMetadata(providerName, provider, accessToken, {
        lastSync: new Date().toISOString(),
        runsSynced: uploaded,
        totalRuns: runs.length,
      });

      this.lastSyncTime = Date.now();
      return { success: true, uploaded, total: runs.length };
    } catch (error) {
      console.error('Sync to cloud failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync runs from cloud to local
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

      // List all run files in cloud
      const files = await provider.listFiles('runs', accessToken);
      const runFiles = files.filter(f => f.startsWith('run_') && f.endsWith('.json'));

      // Download and merge runs
      let downloaded = 0;
      let merged = 0;

      for (const fileName of runFiles) {
        try {
          const content = await provider.downloadFile(`runs/${fileName}`, accessToken);
          const cloudRun = JSON.parse(content);
          
          // Check if local run exists
          const localRun = await StorageService.getRun(cloudRun.id);
          
          if (!localRun) {
            // New run from cloud, add it
            await StorageService.saveRun(cloudRun);
            downloaded++;
          } else {
            // Both exist, use most recent (last-write-wins)
            const localDate = new Date(localRun.date || 0);
            const cloudDate = new Date(cloudRun.date || 0);
            const cloudSyncedAt = new Date(cloudRun.syncedAt || 0);
            
            // If cloud version is newer or has sync timestamp, use cloud
            if (cloudSyncedAt > localDate || cloudDate > localDate) {
              await StorageService.saveRun(cloudRun);
              merged++;
            }
          }
        } catch (error) {
          console.error(`Failed to download run ${fileName}:`, error);
          // Continue with other runs
        }
      }

      this.lastSyncTime = Date.now();
      return { success: true, downloaded, merged, total: runFiles.length };
    } catch (error) {
      console.error('Sync from cloud failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync settings to cloud
   */
  async syncSettingsToCloud() {
    try {
      const providerInfo = await this.getProvider();
      if (!providerInfo) {
        throw new Error('No cloud storage provider connected');
      }

      const { name: providerName, provider } = providerInfo;
      const accessToken = await this.ensureValidToken(providerName);

      const settings = await StorageService.getSettings();
      const content = JSON.stringify(settings, null, 2);
      
      await provider.uploadFile('settings.json', content, accessToken);
      return { success: true };
    } catch (error) {
      console.error('Failed to sync settings:', error);
      throw error;
    }
  }

  /**
   * Sync settings from cloud
   */
  async syncSettingsFromCloud() {
    try {
      const providerInfo = await this.getProvider();
      if (!providerInfo) {
        throw new Error('No cloud storage provider connected');
      }

      const { name: providerName, provider } = providerInfo;
      const accessToken = await this.ensureValidToken(providerName);

      try {
        const content = await provider.downloadFile('settings.json', accessToken);
        const cloudSettings = JSON.parse(content);
        
        // Merge with local settings (cloud takes precedence for conflicting keys)
        const localSettings = await StorageService.getSettings();
        const mergedSettings = { ...localSettings, ...cloudSettings };
        
        await StorageService.saveSettings(mergedSettings);
        return { success: true, settings: mergedSettings };
      } catch (error) {
        if (error.message.includes('not found')) {
          // Settings file doesn't exist in cloud yet, that's okay
          return { success: true, settings: null };
        }
        throw error;
      }
    } catch (error) {
      console.error('Failed to sync settings:', error);
      throw error;
    }
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

  /**
   * Update sync metadata file
   */
  async updateSyncMetadata(providerName, provider, accessToken, metadata) {
    try {
      // Get existing metadata or create new
      let existingMetadata = {};
      try {
        const content = await provider.downloadFile('sync_metadata.json', accessToken);
        existingMetadata = JSON.parse(content);
      } catch (error) {
        // File doesn't exist yet, that's okay
      }

      const updatedMetadata = {
        ...existingMetadata,
        ...metadata,
        deviceId: localStorage.getItem('kinetix_device_id') || 'unknown',
        syncVersion: 1,
      };

      const content = JSON.stringify(updatedMetadata, null, 2);
      await provider.uploadFile('sync_metadata.json', content, accessToken);
    } catch (error) {
      console.error('Failed to update sync metadata:', error);
      // Don't throw - metadata update failure shouldn't break sync
    }
  }

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

