/**
 * Simple Backup Service
 * 
 * Just two functions:
 * 1. exportAllData() - Export everything to a JSON file
 * 2. importAllData(json) - Import from JSON file
 * 
 * That's it. No sync, no conflicts, no complexity.
 */

import { StorageService } from './storageService.js';
import { GoogleDriveProvider } from './googleDriveProvider.js';
import { CloudTokenStorage } from './cloudTokenStorage.js';

const BACKUP_FILENAME = 'kinetix-backup.json';

export class SimpleBackupService {
  /**
   * Export all data to a single JSON file
   * Returns the JSON string (can be saved to file or uploaded)
   */
  static async exportAllData() {
    const runs = await StorageService.getAllRuns();
    const settings = await StorageService.getSettings();
    
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      runs: runs,
      settings: settings,
    };
    
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import data from JSON string
   * WARNING: This replaces all local data!
   */
  static async importAllData(jsonString) {
    const backup = JSON.parse(jsonString);
    
    // Clear existing data
    await StorageService.clearAll();
    
    // Restore runs
    for (const run of backup.runs || []) {
      await StorageService.saveRun(run);
    }
    
    // Restore settings
    if (backup.settings) {
      await StorageService.saveSettings(backup.settings);
    }
    
    return {
      runsRestored: backup.runs?.length || 0,
      settingsRestored: !!backup.settings,
    };
  }

  /**
   * Upload backup to Google Drive
   * Requires: User must be authenticated first
   */
  static async uploadToGoogleDrive() {
    // Check if authenticated
    const hasTokens = await CloudTokenStorage.hasTokens('google');
    if (!hasTokens) {
      throw new Error('Not authenticated with Google Drive. Please authenticate first.');
    }

    // Export data
    const jsonData = await this.exportAllData();
    
    // Get provider and token
    const provider = new GoogleDriveProvider();
    const tokens = await CloudTokenStorage.getTokens('google');
    const accessToken = await this.ensureValidToken('google', tokens, provider);
    
    // Upload to Google Drive
    await provider.uploadFile(BACKUP_FILENAME, jsonData, accessToken);
    
    return { success: true, filename: BACKUP_FILENAME };
  }

  /**
   * Download backup from Google Drive
   * Requires: User must be authenticated first
   */
  static async downloadFromGoogleDrive() {
    // Check if authenticated
    const hasTokens = await CloudTokenStorage.hasTokens('google');
    if (!hasTokens) {
      throw new Error('Not authenticated with Google Drive. Please authenticate first.');
    }

    // Get provider and token
    const provider = new GoogleDriveProvider();
    const tokens = await CloudTokenStorage.getTokens('google');
    const accessToken = await this.ensureValidToken('google', tokens, provider);
    
    // Download from Google Drive
    const jsonData = await provider.downloadFile(BACKUP_FILENAME, accessToken);
    
    // Import data
    const result = await this.importAllData(jsonData);
    
    return { success: true, ...result };
  }

  /**
   * Download backup file (for manual save)
   * Returns a blob URL that can be used to download the file
   */
  static async downloadBackupFile() {
    const jsonData = await this.exportAllData();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinetix-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true };
  }

  /**
   * Import from uploaded file
   * Takes a File object from file input
   */
  static async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await this.importAllData(e.target.result);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Helper: Ensure we have a valid token
   */
  static async ensureValidToken(providerName, tokens, provider) {
    const isValid = await CloudTokenStorage.isTokenValid(providerName);
    
    if (isValid) {
      return tokens.accessToken;
    }

    // Token expired, refresh it
    const refreshed = await provider.refreshAccessToken(tokens.refreshToken);
    await CloudTokenStorage.updateAccessToken(
      providerName,
      refreshed.accessToken,
      refreshed.expiresIn
    );

    return refreshed.accessToken;
  }
}

