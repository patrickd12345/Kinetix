# Unified Storage Architecture: Local + Cloud Coexistence

## Overview

This document describes how local storage (IndexedDB/SwiftData) and cloud storage (Google Drive/Dropbox/OneDrive) coexist in a cohesive, unified storage solution. The architecture follows an **offline-first** approach where local storage is the primary source of truth, with cloud storage serving as backup, sync, and cross-device access.

## Folder Structure

```
web/src/
├── storage/
│   ├── local/              ← storageService.js (IndexedDB abstraction)
│   ├── sync/               ← unifiedStorageService.js + cloudSyncService.js
│   └── providers/          ← googleDriveProvider.js + cloudStorageProvider.js + cloudTokenStorage.js
├── ai/
│   └── README.md           ← Placeholder for Local AI integration
└── components/             ← All use unifiedStorageService

docs/
├── UNIFIED_STORAGE_ARCHITECTURE.md   ← This file
├── CLOUD_STORAGE_ARCHITECTURE.md     ← Cloud specifics
└── HOW_STORAGE_WORKS.md              ← User guide

archive/
└── << deprecated files >>
```

## Single File Cloud Storage

The cloud storage uses **ONE JSON file** per user: `kinetix-data.json`

### Data Structure

```json
{
  "runs": [
    {
      "id": "abc123",
      "date": "2025-01-15T10:30:00Z",
      "distance": 5000,
      "duration": 1800,
      "avgNPI": 142.5,
      "lastModified": "2025-01-15T10:35:00Z",
      "syncedAt": "2025-01-15T10:35:00Z"
    }
  ],
  "settings": {
    "targetNPI": 135.0,
    "unitSystem": "metric",
    "physioMode": false
  },
  "syncMetadata": {
    "lastSync": "2025-01-15T10:35:00Z",
    "deviceId": "web-uuid-123",
    "syncVersion": 1
  }
}
```

### Benefits

- ✅ Single atomic operation per sync
- ✅ Simpler conflict resolution
- ✅ Fewer API calls
- ✅ Easier debugging

## Core Principles

### 1. **Offline-First Architecture**
- **Local storage is primary**: All operations read/write to local storage first
- **Cloud is secondary**: Cloud storage acts as backup and sync mechanism
- **App works offline**: Full functionality without internet connection
- **Sync when online**: Background sync keeps cloud in sync with local

### 2. **Data Consistency**
- **Single source of truth**: Local storage is always authoritative
- **Conflict resolution**: Last-write-wins with timestamp comparison
- **Sync metadata**: Track what's synced, when, and from which device
- **Idempotent operations**: Same operation can be safely repeated

### 3. **User Control**
- **Opt-in cloud sync**: Users choose to enable cloud storage
- **Storage modes**: Local-only or Cloud-synced
- **Easy migration**: Switch between modes without data loss

## Storage Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  (Components, Views, Business Logic)                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Unified Storage Service Layer                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  UnifiedStorageService                                 │  │
│  │  - saveRun() → Local + Cloud (if enabled)             │  │
│  │  - getAllRuns() → Local (with cloud sync in bg)       │  │
│  │  - Conflict resolution                                 │  │
│  │  - Sync coordination                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
        ┌───────▼───────┐       ┌───────▼───────┐
        │  Local Storage │       │ Cloud Storage  │
        │                │       │                │
        │  Web: IndexedDB│       │  Google Drive  │
        │  iOS: SwiftData │       │  Dropbox      │
        │  Watch: SwiftData│      │  OneDrive     │
        └────────────────┘       └────────────────┘
```

## Storage Modes

### Mode 1: **Local-Only** (Default)
- All data stored locally
- No cloud sync
- Fastest performance
- No internet required
- **Use case**: Privacy-focused users, offline-first users

### Mode 2: **Cloud-Synced** (Recommended)
- Primary: Local storage
- Secondary: Cloud storage (backup)
- Automatic background sync
- Works offline, syncs when online
- **Single file sync**: `kinetix-data.json`
- **Use case**: Most users, cross-device access, backup

## Data Flow Patterns

### Write Flow (Cloud-Synced Mode)

```
User saves a run
    │
    ▼
┌─────────────────┐
│ Save to Local   │ ← Immediate (fast, offline-capable)
│ (IndexedDB/     │
│  SwiftData)     │
└────────┬────────┘
         │
         ├─ Success → Mark for sync
         │
         └─ Queue for cloud sync
            │
            ▼
    ┌───────────────┐
    │ Background    │
    │ Sync Service  │
    └───────┬───────┘
            │
            ├─ Online? → Upload to cloud
            │
            └─ Offline? → Queue for later
```

### Read Flow (Cloud-Synced Mode)

```
User requests runs
    │
    ▼
┌─────────────────┐
│ Read from Local │ ← Immediate (always works)
│ (IndexedDB/     │
│  SwiftData)     │
└────────┬────────┘
         │
         ├─ Return results immediately
         │
         └─ Trigger background sync
            │
            ▼
    ┌───────────────┐
    │ Check cloud   │
    │ for updates   │
    └───────┬───────┘
            │
            ├─ New data? → Merge with local
            │
            └─ No changes → Done
```

## Sync Strategy

### Sync Triggers

1. **Immediate Sync**:
   - After saving a run
   - After changing settings
   - User-triggered sync button

2. **Background Sync**:
   - App launch
   - Periodic (every 15 minutes when active)
   - Network reconnection
   - Before app close (if possible)

3. **Manual Sync**:
   - Pull-to-refresh in history view
   - Settings → Cloud Storage → Sync Now

### Sync Process

```javascript
async function syncToCloud() {
  // 1. Get all local runs
  const localRuns = await LocalStorage.getAllRuns();
  
  // 2. Get sync metadata (track what's already synced)
  const syncMetadata = await getSyncMetadata();
  
  // 3. Identify what needs syncing
  const runsToSync = localRuns.filter(run => {
    const lastSynced = syncMetadata.syncedRuns[run.id];
    const lastModified = new Date(run.lastModified || run.date);
    return !lastSynced || lastSynced < lastModified;
  });
  
  // 4. Upload to cloud
  for (const run of runsToSync) {
    await CloudStorage.uploadFile(`runs/run_${run.id}.json`, run);
    syncMetadata.syncedRuns[run.id] = Date.now();
  }
  
  // 5. Update sync metadata
  await saveSyncMetadata(syncMetadata);
}

async function syncFromCloud() {
  // 1. Get all cloud runs
  const cloudRuns = await CloudStorage.listFiles('runs');
  
  // 2. Get local runs
  const localRuns = await LocalStorage.getAllRuns();
  const localRunIds = new Set(localRuns.map(r => r.id));
  
  // 3. Download new runs from cloud
  for (const cloudRunFile of cloudRuns) {
    const cloudRun = await CloudStorage.downloadFile(cloudRunFile);
    const runId = extractRunId(cloudRunFile);
    
    if (!localRunIds.has(runId)) {
      // New run from cloud, add to local
      await LocalStorage.saveRun(cloudRun);
    } else {
      // Both exist, resolve conflict
      const localRun = localRuns.find(r => r.id === runId);
      const merged = resolveConflict(localRun, cloudRun);
      await LocalStorage.saveRun(merged);
    }
  }
}
```

## Conflict Resolution

### Strategy: Last-Write-Wins with Timestamps

```javascript
function resolveConflict(localRun, cloudRun) {
  const localModified = new Date(localRun.lastModified || localRun.date);
  const cloudModified = new Date(cloudRun.lastModified || cloudRun.date);
  const cloudSyncedAt = new Date(cloudRun.syncedAt || 0);
  
  // If cloud version has a sync timestamp and it's newer, prefer cloud
  if (cloudSyncedAt > localModified) {
    return cloudRun;
  }
  
  // Otherwise, prefer the most recently modified
  return cloudModified > cloudModified ? localRun : cloudRun;
}
```

### Conflict Types

1. **Run Conflicts**:
   - Same run modified on different devices
   - Resolution: Last-write-wins (timestamp-based)
   - User notification for significant conflicts

2. **Settings Conflicts**:
   - Settings changed on multiple devices
   - Resolution: Merge non-conflicting keys, last-write-wins for conflicts
   - Example: `{targetNPI: 140, unitSystem: 'metric'}` + `{targetNPI: 135, physioMode: true}` 
   - Result: `{targetNPI: 140, unitSystem: 'metric', physioMode: true}` (cloud's targetNPI wins)

3. **Deletion Conflicts**:
   - Run deleted on one device, modified on another
   - Resolution: Deletion wins (safer to lose data than have orphaned data)

## Sync Metadata

### Metadata Structure

```typescript
interface SyncMetadata {
  // Overall sync state
  lastSync: string;              // ISO timestamp
  syncMode: 'local' | 'cloud-synced' | 'cloud-primary';
  provider: 'google' | 'dropbox' | 'onedrive' | null;
  
  // Per-run sync tracking
  syncedRuns: {
    [runId: string]: number;      // Timestamp of last sync
  };
  
  // Device tracking
  deviceId: string;
  lastDeviceSync: {
    [deviceId: string]: number;   // Last sync from this device
  };
  
  // Conflict tracking
  conflicts: Array<{
    runId: string;
    localModified: string;
    cloudModified: string;
    resolved: boolean;
  }>;
  
  // Sync statistics
  stats: {
    totalRuns: number;
    syncedRuns: number;
    pendingSync: number;
    lastSyncDuration: number;
  };
}
```

### Metadata Storage

- **Web**: Stored in IndexedDB (`sync_metadata` store)
- **iOS/watchOS**: Stored in SwiftData (`SyncMetadata` model)
- **Cloud**: Stored as `sync_metadata.json` in cloud storage

## Implementation: Unified Storage Service

### Web App Implementation

```javascript
// UnifiedStorageService.js
export class UnifiedStorageService {
  constructor() {
    this.localStorage = new LocalStorageService();
    this.cloudSync = new CloudSyncService();
    this.syncMode = 'local'; // 'local' | 'cloud-synced' | 'cloud-primary'
  }

  async initialize() {
    // Load sync mode from settings
    const settings = await this.localStorage.getSettings();
    this.syncMode = settings.syncMode || 'local';
    
    // If cloud-synced, trigger background sync
    if (this.syncMode === 'cloud-synced') {
      this.cloudSync.syncFromCloud().catch(console.error);
    }
  }

  async saveRun(run) {
    // Always save to local first (offline-first)
    const saved = await this.localStorage.saveRun(run);
    
    if (!saved) {
      throw new Error('Failed to save run locally');
    }
    
    // If cloud-synced, queue for cloud sync
    if (this.syncMode === 'cloud-synced') {
      // Don't await - fire and forget for performance
      this.cloudSync.syncRunToCloud(run).catch(error => {
        console.error('Background sync failed:', error);
        // Queue for retry later
      });
    } else if (this.syncMode === 'cloud-primary') {
      // Cloud-primary: must sync before returning
      await this.cloudSync.syncRunToCloud(run);
    }
    
    return saved;
  }

  async getAllRuns() {
    // Always read from local (fast, offline-capable)
    const runs = await this.localStorage.getAllRuns();
    
    // Trigger background sync if cloud-synced
    if (this.syncMode === 'cloud-synced') {
      this.cloudSync.syncFromCloud().catch(console.error);
    }
    
    return runs;
  }

  async getRun(id) {
    // Read from local
    let run = await this.localStorage.getRun(id);
    
    // If cloud-primary and not found locally, try cloud
    if (!run && this.syncMode === 'cloud-primary') {
      run = await this.cloudSync.getRunFromCloud(id);
      if (run) {
        // Cache locally
        await this.localStorage.saveRun(run);
      }
    }
    
    return run;
  }

  async deleteRun(id) {
    // Delete from local
    await this.localStorage.deleteRun(id);
    
    // Delete from cloud if synced
    if (this.syncMode !== 'local') {
      await this.cloudSync.deleteRunFromCloud(id).catch(console.error);
    }
  }

  async saveSettings(settings) {
    // Save to local
    await this.localStorage.saveSettings(settings);
    
    // Update sync mode if changed
    if (settings.syncMode && settings.syncMode !== this.syncMode) {
      this.syncMode = settings.syncMode;
      await this.initialize();
    }
    
    // Sync to cloud if enabled
    if (this.syncMode !== 'local') {
      await this.cloudSync.syncSettingsToCloud(settings).catch(console.error);
    }
  }

  async getSettings() {
    const settings = await this.localStorage.getSettings();
    
    // If cloud-synced, check for cloud updates
    if (this.syncMode === 'cloud-synced') {
      try {
        const cloudSettings = await this.cloudSync.getSettingsFromCloud();
        if (cloudSettings) {
          // Merge with local (cloud takes precedence)
          return { ...settings, ...cloudSettings };
        }
      } catch (error) {
        // Cloud unavailable, use local
        console.warn('Cloud settings unavailable, using local:', error);
      }
    }
    
    return settings;
  }

  // Sync management
  async enableCloudSync(provider) {
    // Authenticate with provider
    await this.cloudSync.authenticate(provider);
    
    // Update sync mode
    const settings = await this.getSettings();
    settings.syncMode = 'cloud-synced';
    await this.saveSettings(settings);
    
    // Initial sync
    await this.cloudSync.fullSync();
  }

  async disableCloudSync() {
    // Update sync mode
    const settings = await this.getSettings();
    settings.syncMode = 'local';
    await this.saveSettings(settings);
    
    // Clear cloud tokens (optional - user might want to keep them)
    // await this.cloudSync.disconnect();
  }

  async manualSync() {
    if (this.syncMode === 'local') {
      throw new Error('Cloud sync not enabled');
    }
    
    return await this.cloudSync.fullSync();
  }
}
```

## Migration Strategy

### Existing Users (Local-Only → Cloud-Synced)

1. **Opt-in**: User enables cloud storage in settings
2. **Initial Upload**: All existing local data uploaded to cloud
3. **Background Sync**: Ongoing sync keeps cloud updated
4. **No Data Loss**: Local data remains, cloud is backup

### New Users

1. **Default**: Start with local-only mode
2. **Onboarding**: Option to enable cloud sync during setup
3. **Progressive**: Can enable cloud sync anytime

## Platform-Specific Considerations

### Web App
- **Local**: IndexedDB
- **Cloud**: Google Drive/Dropbox/OneDrive via OAuth
- **Sync**: Background service worker (if PWA) or periodic checks

### iPhone App
- **Local**: SwiftData
- **Cloud**: OAuth via ASWebAuthenticationSession
- **Sync**: Background URLSession tasks
- **Watch Integration**: Syncs cloud tokens to Watch via Watch Connectivity

### Watch App
- **Local**: SwiftData
- **Cloud**: Delegates to iPhone (no direct OAuth)
- **Sync**: Via iPhone proxy or direct if provider supports

## Error Handling

### Network Errors
- **Offline**: Queue sync operations, retry when online
- **Timeout**: Retry with exponential backoff
- **Rate Limit**: Respect rate limits, queue requests

### Sync Errors
- **Upload Failure**: Keep in local, retry later
- **Download Failure**: Use local data, retry later
- **Conflict Error**: Notify user, allow manual resolution

### Storage Errors
- **Local Full**: Alert user, suggest cloud sync
- **Cloud Full**: Alert user, suggest cleanup
- **Corruption**: Restore from cloud backup

## Performance Considerations

### Optimization Strategies

1. **Batch Operations**: Sync multiple runs in one request
2. **Incremental Sync**: Only sync changed data
3. **Compression**: Compress large route data before upload
4. **Lazy Loading**: Don't sync route data unless needed
5. **Background Priority**: Sync doesn't block UI

### Storage Footprint

- **Local**: Full dataset (for offline access)
- **Cloud**: Full dataset (backup)
- **Sync Metadata**: Minimal (~few KB)

## Security & Privacy

### Data Protection
- **Local**: Encrypted at rest (device encryption)
- **Cloud**: User's own cloud account (their encryption)
- **Tokens**: Encrypted storage (Keychain/encrypted IndexedDB)

### Privacy
- **No Intermediary**: Direct user-to-cloud connection
- **User Control**: User owns their data in their cloud
- **Opt-in**: Cloud sync is optional

## User Experience

### Settings UI

```
┌─────────────────────────────────────┐
│  Cloud Storage                      │
├─────────────────────────────────────┤
│  Status: Connected (Google Drive)   │
│  Last Sync: 2 minutes ago           │
│                                     │
│  [Sync Now]  [Disconnect]           │
│                                     │
│  Storage Mode:                      │
│  ○ Local Only                       │
│  ● Cloud Synced                     │
│  ○ Cloud Primary                    │
│                                     │
│  Sync Options:                      │
│  ☑ Sync Runs                        │
│  ☑ Sync Settings                    │
│  ☐ Sync Route Data (large)          │
└─────────────────────────────────────┘
```

### Sync Indicators

- **Status Badge**: Shows sync status in UI
- **Last Sync Time**: Display when last synced
- **Pending Count**: Show number of items pending sync
- **Error Notifications**: Alert on sync failures

## Testing Strategy

### Unit Tests
- Storage service operations
- Conflict resolution logic
- Sync metadata management

### Integration Tests
- Local + cloud sync flow
- Offline/online transitions
- Conflict scenarios

### E2E Tests
- Full sync cycle
- Multi-device scenarios
- Error recovery

## Conclusion

This unified storage architecture provides:

✅ **Offline-first**: Works without internet
✅ **Cloud backup**: Automatic backup to user's cloud
✅ **Cross-device**: Access data from any device
✅ **User control**: Choose storage mode
✅ **Data safety**: No data loss, conflict resolution
✅ **Performance**: Fast local access, background sync
✅ **Privacy**: User-owned data in their cloud

The architecture seamlessly integrates local and cloud storage, giving users the best of both worlds: fast local access with cloud backup and sync.

