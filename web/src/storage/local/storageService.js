/**
 * Storage service for persisting runs and settings
 * Uses IndexedDB for large datasets and better performance
 */
const DB_NAME = 'kinetix_db';
const DB_VERSION = 1;
const RUNS_STORE = 'runs';
const SETTINGS_STORE = 'settings';

// Legacy localStorage keys for migration
const RUNS_KEY = 'kinetix_runs';
const SETTINGS_KEY = 'kinetix_settings';

let dbPromise = null;

/**
 * Initialize IndexedDB database
 */
function getDB() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create runs store with id as keyPath
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        const runsStore = db.createObjectStore(RUNS_STORE, { keyPath: 'id' });
        runsStore.createIndex('date', 'date', { unique: false });
      }

      // Create settings store
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

/**
 * Migrate data from localStorage to IndexedDB
 */
async function migrateFromLocalStorage() {
  try {
    const db = await getDB();
    const migrationKey = 'kinetix_migrated';
    
    // Check if already migrated
    const checkTx = db.transaction([SETTINGS_STORE], 'readonly');
    const checkStore = checkTx.objectStore(SETTINGS_STORE);
    const checkRequest = checkStore.get(migrationKey);
    
    const alreadyMigrated = await new Promise((resolve) => {
      checkRequest.onsuccess = () => {
        resolve(!!checkRequest.result);
      };
      checkRequest.onerror = () => resolve(false);
    });

    if (alreadyMigrated) {
      return; // Already migrated
    }

    // Migrate runs
    const runsData = localStorage.getItem(RUNS_KEY);
    if (runsData) {
      try {
        const runs = JSON.parse(runsData);
        if (Array.isArray(runs) && runs.length > 0) {
          const tx = db.transaction([RUNS_STORE], 'readwrite');
          const store = tx.objectStore(RUNS_STORE);
          
          for (const run of runs) {
            // Ensure date is a string for IndexedDB
            const runData = {
              ...run,
              date: typeof run.date === 'string' ? run.date : new Date(run.date).toISOString(),
            };
            store.put(runData);
          }
          
          await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          
          console.log(`Migrated ${runs.length} runs from localStorage to IndexedDB`);
        }
      } catch (error) {
        console.error('Error migrating runs:', error);
      }
    }

    // Migrate settings
    const settingsData = localStorage.getItem(SETTINGS_KEY);
    if (settingsData) {
      try {
        const settings = JSON.parse(settingsData);
        const tx = db.transaction([SETTINGS_STORE], 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);
        store.put({ key: 'settings', value: settings });
        
        await new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        
        console.log('Migrated settings from localStorage to IndexedDB');
      } catch (error) {
        console.error('Error migrating settings:', error);
      }
    }

    // Mark as migrated
    const markTx = db.transaction([SETTINGS_STORE], 'readwrite');
    const markStore = markTx.objectStore(SETTINGS_STORE);
    markStore.put({ key: migrationKey, value: true });
    
    await new Promise((resolve, reject) => {
      markTx.oncomplete = () => resolve();
      markTx.onerror = () => reject(markTx.error);
    });

    // Clear localStorage after successful migration
    localStorage.removeItem(RUNS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw - allow app to continue with IndexedDB
  }
}

// Initialize and migrate on first load
migrateFromLocalStorage().catch(console.error);

export class StorageService {
  /**
   * Save a run (async)
   */
  static async saveRun(run) {
    try {
      const db = await getDB();
      const tx = db.transaction([RUNS_STORE], 'readwrite');
      const store = tx.objectStore(RUNS_STORE);
      
      const runData = run.toJSON();
      // Ensure date is a string
      if (runData.date instanceof Date) {
        runData.date = runData.date.toISOString();
      }
      
      await new Promise((resolve, reject) => {
        const request = store.put(runData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to save run:', error);
      return false;
    }
  }

  /**
   * Get all runs (async)
   */
  static async getAllRuns() {
    try {
      const db = await getDB();
      const tx = db.transaction([RUNS_STORE], 'readonly');
      const store = tx.objectStore(RUNS_STORE);
      
      const runs = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      
      return runs;
    } catch (error) {
      console.error('Failed to load runs:', error);
      return [];
    }
  }

  /**
   * Get a run by ID (async)
   */
  static async getRun(id) {
    try {
      const db = await getDB();
      const tx = db.transaction([RUNS_STORE], 'readonly');
      const store = tx.objectStore(RUNS_STORE);
      
      const run = await new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      
      return run;
    } catch (error) {
      console.error('Failed to get run:', error);
      return null;
    }
  }

  /**
   * Delete a run (async)
   */
  static async deleteRun(id) {
    try {
      const db = await getDB();
      const tx = db.transaction([RUNS_STORE], 'readwrite');
      const store = tx.objectStore(RUNS_STORE);
      
      await new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete run:', error);
      return false;
    }
  }

  /**
   * Get settings (async)
   */
  static async getSettings() {
    try {
      const db = await getDB();
      const tx = db.transaction([SETTINGS_STORE], 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      
      const result = await new Promise((resolve, reject) => {
        const request = store.get('settings');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (result && result.value) {
        return result.value;
      }
      
      // Default settings
      return {
        targetNPI: 135.0,
        unitSystem: 'metric',
        physioMode: false,
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return {
        targetNPI: 135.0,
        unitSystem: 'metric',
        physioMode: false,
      };
    }
  }

  /**
   * Save settings (async)
   */
  static async saveSettings(settings) {
    try {
      const db = await getDB();
      const tx = db.transaction([SETTINGS_STORE], 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      
      await new Promise((resolve, reject) => {
        const request = store.put({ key: 'settings', value: settings });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Clear all data (async)
   */
  static async clearAll() {
    try {
      const db = await getDB();
      
      // Clear runs
      const runsTx = db.transaction([RUNS_STORE], 'readwrite');
      const runsStore = runsTx.objectStore(RUNS_STORE);
      await new Promise((resolve, reject) => {
        const request = runsStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      // Clear settings
      const settingsTx = db.transaction([SETTINGS_STORE], 'readwrite');
      const settingsStore = settingsTx.objectStore(SETTINGS_STORE);
      await new Promise((resolve, reject) => {
        const request = settingsStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }
}
