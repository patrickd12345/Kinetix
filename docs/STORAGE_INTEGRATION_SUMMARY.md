# Storage Integration Summary

## Overview

This document summarizes how local storage and cloud storage coexist in Kinetix, providing a unified, offline-first storage solution.

## Architecture

### Unified Storage Service

The `UnifiedStorageService` acts as a single interface for all storage operations, coordinating between:

1. **Local Storage** (Primary)
   - Web: IndexedDB
   - iOS/watchOS: SwiftData
   - Always available, fast, offline-capable

2. **Cloud Storage** (Secondary/Backup)
   - Google Drive, Dropbox, OneDrive
   - User's own cloud account
   - Backup, sync, cross-device access

### Storage Modes

1. **Local-Only** (Default)
   - All data stored locally
   - No cloud sync
   - Fastest, most private

2. **Cloud-Synced** (Recommended)
   - Primary: Local storage
   - Secondary: Cloud storage (backup)
   - Automatic background sync
   - Works offline, syncs when online

3. **Cloud-Primary** (Advanced)
   - Primary: Cloud storage
   - Cache: Local storage
   - Requires internet for writes
   - Best for multi-device users

## Key Principles

### 1. Offline-First
- All operations read/write to local storage first
- Cloud sync happens in background
- App works fully offline

### 2. Data Consistency
- Local storage is always authoritative
- Cloud acts as backup and sync mechanism
- Conflict resolution: Last-write-wins with timestamps

### 3. User Control
- Opt-in cloud sync
- Choose storage mode
- Selective sync options

## Implementation Files

### Web App

- `src/services/unifiedStorageService.js` - Main unified storage interface
- `src/services/storageService.js` - Local storage (IndexedDB)
- `src/services/cloudSyncService.js` - Cloud sync coordination
- `src/services/cloudStorageProvider.js` - Base cloud provider interface
- `src/services/googleDriveProvider.js` - Google Drive implementation
- `src/services/cloudTokenStorage.js` - Secure token storage

### Architecture Documents

- `UNIFIED_STORAGE_ARCHITECTURE.md` - Complete architecture details
- `CLOUD_STORAGE_ARCHITECTURE.md` - Cloud storage specifics

## Usage

### In Application Code

```javascript
import { unifiedStorageService } from './services/unifiedStorageService';

// Initialize (on app startup)
await unifiedStorageService.initialize();

// Save a run (automatically syncs to cloud if enabled)
await unifiedStorageService.saveRun(run);

// Get all runs (reads from local, syncs in background)
const runs = await unifiedStorageService.getAllRuns();

// Get settings (merges local + cloud if cloud-synced)
const settings = await unifiedStorageService.getSettings();

// Manual sync
await unifiedStorageService.fullSync();

// Enable cloud sync
await unifiedStorageService.enableCloudSync('google');
```

### Migration from Direct StorageService

**Before:**
```javascript
import { StorageService } from './services/storageService';
await StorageService.saveRun(run);
```

**After:**
```javascript
import { unifiedStorageService } from './services/unifiedStorageService';
await unifiedStorageService.saveRun(run);
```

The unified service maintains the same API, so migration is straightforward.

## Benefits

✅ **Offline-First**: App works without internet
✅ **Cloud Backup**: Automatic backup to user's cloud
✅ **Cross-Device**: Access data from any device
✅ **User Control**: Choose storage mode
✅ **Data Safety**: No data loss, conflict resolution
✅ **Performance**: Fast local access, background sync
✅ **Privacy**: User-owned data in their cloud

## Next Steps

1. ✅ Core unified storage service created
2. ✅ Cloud sync service implemented
3. ⏳ UI components for cloud storage settings
4. ⏳ OAuth flow implementation
5. ⏳ iOS/watchOS implementation
6. ⏳ Testing and validation

## Notes

- Local storage remains the primary source of truth
- Cloud sync is optional and opt-in
- All existing code continues to work (unified service wraps local service)
- Migration is seamless - no breaking changes

