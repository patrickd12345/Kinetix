# Kinetix Storage Refactoring Summary

## What Was Removed

### Files Archived
- `simpleBackupService.js` → `/archive`
- `SIMPLE_CLOUD_STORAGE.md` → `/archive`
- `SIMPLIFICATION_PLAN.md` → `/archive`

### Features Removed
- ❌ Simple backup system (incompatible with multi-device sync)
- ❌ Cloud-primary mode (removed for simplicity)
- ❌ Multi-file cloud storage (runs/run_*.json, settings.json, sync_metadata.json)
- ❌ Direct StorageService usage in components

## What Was Kept

### Core Storage System
- ✅ `storageService.js` - Local IndexedDB abstraction
- ✅ `unifiedStorageService.js` - Main entry point for all storage
- ✅ `cloudSyncService.js` - Cloud sync coordination
- ✅ `cloudStorageProvider.js` - Base provider interface
- ✅ `googleDriveProvider.js` - Google Drive implementation
- ✅ `cloudTokenStorage.js` - Secure token management

### Features Kept
- ✅ Offline-first architecture
- ✅ Cloud-synced mode (local + cloud backup)
- ✅ Conflict resolution (timestamp-based)
- ✅ OAuth authentication
- ✅ Token refresh

## How Sync Works

### Single File Architecture

**Cloud Storage**: One file `kinetix-data.json` contains:
- All runs
- Settings
- Sync metadata

### Sync Flow

1. **Local Save**:
   ```
   User saves run
   → unifiedStorageService.saveRun()
   → StorageService.saveRun() (local IndexedDB)
   → Background: cloudSyncService.syncRunsToCloud()
   → Upload kinetix-data.json to Google Drive
   ```

2. **Local Load**:
   ```
   User loads runs
   → unifiedStorageService.getAllRuns()
   → StorageService.getAllRuns() (local IndexedDB) - immediate return
   → Background: cloudSyncService.syncRunsFromCloud()
   → Download kinetix-data.json from Google Drive
   → Merge with local (last-write-wins)
   ```

3. **Conflict Resolution**:
   ```
   Same run on two devices:
   → Compare lastModified timestamps
   → Most recent wins
   → Both devices converge to same data
   ```

## How Cloud Works

### OAuth Flow
1. User clicks "Connect Google Drive"
2. Redirects to Google OAuth
3. User authorizes
4. Exchange code for tokens
5. Store tokens (encrypted in IndexedDB)
6. Ready to sync

### Sync Process
1. **To Cloud**:
   - Get all local runs + settings
   - Create/update `kinetix-data.json`
   - Upload to Google Drive `/Kinetix/kinetix-data.json`

2. **From Cloud**:
   - Download `kinetix-data.json` from Google Drive
   - Parse JSON
   - Merge with local (last-write-wins)
   - Save merged data to local

### Token Management
- Access tokens expire (1 hour)
- Refresh tokens don't expire (until revoked)
- Automatic refresh before expiration
- Encrypted storage in IndexedDB

## How Local DB Works

### IndexedDB Structure
```
kinetix_db
├── runs (objectStore)
│   └── Key: run.id
│   └── Index: date
└── settings (objectStore)
    └── Key: 'settings'
```

### Operations
- **saveRun()**: Put run in runs store
- **getAllRuns()**: Get all from runs store
- **getRun(id)**: Get by id
- **deleteRun(id)**: Delete by id
- **getSettings()**: Get from settings store
- **saveSettings()**: Put in settings store
- **clearAll()**: Clear both stores

### Offline-First
- All operations work offline
- Cloud sync is optional
- Local is always authoritative

## Where Local AI Will Integrate Later

### Planned Location
- `/web/src/ai/` directory (placeholder created)

### Integration Points
1. **Run Analysis**:
   - After run saved → AI analysis
   - Store analysis with run data
   - Sync analysis to cloud

2. **AI Service**:
   - Local LLM integration
   - Privacy-preserving
   - Offline capable

3. **Storage Integration**:
   - AI analysis stored in run data
   - Synced via unifiedStorageService
   - No separate AI storage needed

## Final Architecture

```
Application Layer
    ↓
unifiedStorageService (single entry point)
    ↓
    ├─→ StorageService (local IndexedDB)
    └─→ cloudSyncService (Google Drive)
            ↓
        googleDriveProvider
            ↓
        Google Drive API
            ↓
        kinetix-data.json (single file)
```

## Migration Notes

### For Developers
- **Always use** `unifiedStorageService` - never `StorageService` directly
- **Import path**: `'../storage/sync/unifiedStorageService'`
- **Single file sync**: All data in one JSON file
- **Offline-first**: App works without cloud

### For Users
- **Opt-in cloud sync**: Enable in settings
- **Automatic sync**: Background sync when enabled
- **No data loss**: Local is always primary
- **Cross-device**: Access data from any device

## Testing Checklist

- [ ] Local storage works offline
- [ ] Cloud sync uploads correctly
- [ ] Cloud sync downloads correctly
- [ ] Conflict resolution works
- [ ] Token refresh works
- [ ] OAuth flow works
- [ ] All components use unifiedStorageService
- [ ] Import paths are correct
- [ ] No direct StorageService usage

## Refactoring Phases Completed

### Phase 1: Clean Up ✅
- Archived simple backup system
- Removed unused files

### Phase 2: Consolidate ✅
- All components use unifiedStorageService
- Removed direct StorageService usage

### Phase 3: Simplify Cloud ✅
- Refactored to single file (kinetix-data.json)
- Simplified sync logic

### Phase 4: Reorganize ✅
- Created new folder structure
- Updated all import paths

### Phase 5: Documentation ✅
- Updated architecture docs
- Created refactoring summary

## Final Status

✅ **All phases complete**
✅ **Build succeeds**
✅ **No linter errors**
✅ **All imports updated**
✅ **Ready for testing**

