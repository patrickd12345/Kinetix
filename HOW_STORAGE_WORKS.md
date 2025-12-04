# How Unified Storage Works - Detailed Explanation

## The Big Picture

Kinetix uses a **two-layer storage system**:
1. **Local Storage** (IndexedDB on web, SwiftData on iOS/watchOS) - Fast, always available, works offline
2. **Cloud Storage** (Google Drive/Dropbox/OneDrive) - Backup, sync, cross-device access

The **UnifiedStorageService** coordinates between these two layers automatically.

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Your App Code                             │
│  (Components, Views, etc.)                                  │
│                                                              │
│  unifiedStorageService.saveRun(run)                         │
│  unifiedStorageService.getAllRuns()                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           UnifiedStorageService                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Decision Layer:                                        │  │
│  │  - What's the sync mode? (local/cloud-synced/primary) │  │
│  │  - Is cloud connected?                                 │  │
│  │  - Should I sync now or later?                         │  │
│  └──────────────────────────────────────────────────────┘  │
└───────┬───────────────────────────────┬─────────────────────┘
        │                               │
        │                               │
┌───────▼────────┐              ┌───────▼────────┐
│ Local Storage │              │ Cloud Storage   │
│ (Primary)      │              │ (Backup/Sync)  │
│                │              │                │
│ IndexedDB      │              │ Google Drive   │
│ SwiftData      │              │ Dropbox        │
│                │              │ OneDrive       │
└────────────────┘              └────────────────┘
```

## How It Works: Step by Step

### Scenario 1: Saving a Run (Cloud-Synced Mode)

**What happens when you save a run:**

```
1. You call: unifiedStorageService.saveRun(run)
   │
   ├─► Step 1: Save to Local Storage (IndexedDB)
   │   └─► This happens IMMEDIATELY
   │   └─► Always works, even offline
   │   └─► Returns success right away
   │
   ├─► Step 2: Check Sync Mode
   │   └─► If "local-only" → Done! (no cloud sync)
   │   └─► If "cloud-synced" → Continue to Step 3
   │   └─► If "cloud-primary" → Must sync before returning
   │
   └─► Step 3: Queue for Cloud Sync (if cloud-synced)
       │
       ├─► Check: Is internet available?
       │   ├─► Yes → Upload to cloud NOW (in background)
       │   └─► No → Queue for later (when online)
       │
       └─► Upload to Google Drive/Dropbox/OneDrive
           └─► File: /Kinetix/runs/run_abc123.json
           └─► Updates sync metadata
```

**Key Points:**
- ✅ **Local save is immediate** - Your app doesn't wait for cloud
- ✅ **Cloud sync is background** - Doesn't block the UI
- ✅ **Works offline** - If no internet, cloud sync queues for later
- ✅ **No data loss** - Even if cloud fails, local save succeeded

### Scenario 2: Loading Runs (Cloud-Synced Mode)

**What happens when you load runs:**

```
1. You call: unifiedStorageService.getAllRuns()
   │
   ├─► Step 1: Read from Local Storage (IndexedDB)
   │   └─► This happens IMMEDIATELY
   │   └─► Returns local runs right away
   │   └─► App shows data immediately (fast!)
   │
   ├─► Step 2: Return Local Data to App
   │   └─► Your UI updates with local runs
   │
   └─► Step 3: Background Sync (if cloud-synced)
       │
       ├─► Check cloud for new/updated runs
       │   ├─► Download any new runs from cloud
       │   ├─► Resolve conflicts (if same run modified on 2 devices)
       │   └─► Update local storage with cloud changes
       │
       └─► If new data found:
           └─► App automatically refreshes (or user can pull-to-refresh)
```

**Key Points:**
- ✅ **Fast local read** - Data appears instantly
- ✅ **Background sync** - Cloud check happens without blocking
- ✅ **Automatic merge** - New cloud data automatically added locally
- ✅ **Conflict resolution** - Handles same-run-edited-on-two-devices

### Scenario 3: Conflict Resolution

**What if you edit the same run on two devices?**

```
Device A (iPhone): Edit run_123, change distance to 5km
Device B (Web): Edit run_123, change distance to 6km

Both devices sync to cloud:

┌─────────────────────────────────────────────────┐
│  Cloud Storage                                  │
│  run_123.json:                                  │
│  - Device A: distance=5km, modified=10:00 AM   │
│  - Device B: distance=6km, modified=10:05 AM   │
└─────────────────────────────────────────────────┘
                        │
                        ▼
            Conflict Detected!
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  Resolution: Last-Write-Wins                     │
│                                                  │
│  Device B's version wins (10:05 > 10:00)       │
│  Result: distance=6km                            │
│                                                  │
│  Both devices sync and get: distance=6km        │
└─────────────────────────────────────────────────┘
```

**How it works:**
1. Each run has a `lastModified` timestamp
2. When syncing, compare timestamps
3. Most recent version wins
4. Both devices end up with the same data

### Scenario 4: Offline Usage

**What happens when you're offline?**

```
User is offline (no internet):
│
├─► Save Run:
│   ├─► ✅ Saves to local storage (works!)
│   ├─► ⏸️ Cloud sync queues for later
│   └─► App continues normally
│
├─► Load Runs:
│   ├─► ✅ Reads from local storage (works!)
│   ├─► ⏸️ Cloud sync skipped (no internet)
│   └─► App shows local data
│
└─► When Internet Returns:
    ├─► Automatic background sync triggers
    ├─► Queued saves upload to cloud
    ├─► Cloud changes download to local
    └─► Everything syncs automatically
```

**Key Points:**
- ✅ **Fully functional offline** - All features work without internet
- ✅ **Automatic sync when online** - No manual intervention needed
- ✅ **No data loss** - Everything saved locally, synced later

## Storage Modes Explained

### Mode 1: Local-Only (Default)

```
┌─────────────────────────────────────┐
│  Local Storage Only                 │
│                                     │
│  ✅ Fast                            │
│  ✅ Private                         │
│  ✅ Works offline                   │
│  ❌ No backup                       │
│  ❌ No cross-device                 │
└─────────────────────────────────────┘

Flow:
saveRun() → Local Storage → Done
getAllRuns() → Local Storage → Return
```

### Mode 2: Cloud-Synced (Recommended)

```
┌─────────────────────────────────────┐
│  Local + Cloud Sync                 │
│                                     │
│  ✅ Fast (local reads)              │
│  ✅ Backup (cloud)                  │
│  ✅ Works offline                   │
│  ✅ Cross-device                    │
│  ✅ Automatic sync                  │
└─────────────────────────────────────┘

Flow:
saveRun() → Local Storage → Queue Cloud Sync
getAllRuns() → Local Storage → Return → Background Cloud Sync
```

### Mode 3: Cloud-Primary (Advanced)

```
┌─────────────────────────────────────┐
│  Cloud First, Local Cache          │
│                                     │
│  ✅ Always latest data              │
│  ✅ Multi-device sync               │
│  ❌ Requires internet for writes   │
│  ❌ Slower (waits for cloud)        │
└─────────────────────────────────────┘

Flow:
saveRun() → Cloud Storage → Wait → Local Cache → Return
getAllRuns() → Cloud Sync → Local Cache → Return
```

## Code Examples

### Example 1: Saving a Run

```javascript
// In your component
import { unifiedStorageService } from './services/unifiedStorageService';

// Save a run
const run = {
  id: 'abc123',
  date: new Date(),
  distance: 5000,
  duration: 1800,
  avgNPI: 142.5,
  // ... other fields
};

// This one call handles everything:
await unifiedStorageService.saveRun(run);

// What happens behind the scenes:
// 1. Saves to IndexedDB (local) - immediate
// 2. If cloud-synced: uploads to Google Drive (background)
// 3. Updates sync metadata
// 4. Returns success
```

### Example 2: Loading Runs

```javascript
// Get all runs
const runs = await unifiedStorageService.getAllRuns();

// What happens behind the scenes:
// 1. Reads from IndexedDB (local) - immediate return
// 2. Returns local runs to your component
// 3. If cloud-synced: checks cloud in background
// 4. If new cloud data: merges with local
// 5. Component can refresh if needed
```

### Example 3: Enabling Cloud Sync

```javascript
// User clicks "Link Google Drive" in settings

// Step 1: Authenticate with Google
const authUrl = await googleDriveProvider.getAuthorizationUrl();
// Opens browser, user authorizes
// Redirects back with code

// Step 2: Exchange code for tokens
const tokens = await googleDriveProvider.exchangeCodeForToken(code);
// Tokens stored securely in encrypted IndexedDB

// Step 3: Enable cloud sync
await unifiedStorageService.enableCloudSync('google');
// Updates settings: syncMode = 'cloud-synced'
// Initial sync: uploads all local data to cloud
```

## Data Flow: Complete Example

Let's trace a complete example from start to finish:

### User Journey: First Run with Cloud Sync Enabled

```
1. User opens app
   │
   ├─► unifiedStorageService.initialize()
   │   ├─► Loads settings from local
   │   ├─► Checks syncMode = 'cloud-synced'
   │   ├─► Checks if cloud connected (has tokens)
   │   └─► Triggers background sync
   │
   └─► App ready, shows local data

2. User starts a run
   │
   └─► Run tracking happens (GPS, metrics, etc.)

3. User finishes and saves run
   │
   ├─► unifiedStorageService.saveRun(run)
   │   │
   │   ├─► Saves to IndexedDB (local)
   │   │   └─► File: kinetix_db → runs store → run_abc123
   │   │   └─► Returns success immediately
   │   │
   │   └─► Cloud sync (background)
   │       │
   │       ├─► Gets valid access token (or refreshes if expired)
   │       ├─► Ensures /Kinetix/runs folder exists in Google Drive
   │       ├─► Uploads run_abc123.json to Google Drive
   │       │   └─► Path: /Kinetix/runs/run_abc123.json
   │       └─► Updates sync metadata
   │           └─► Marks run_abc123 as synced at timestamp
   │
   └─► User sees "Run saved!" message

4. User opens app on another device (e.g., iPhone)
   │
   ├─► App loads
   │   └─► unifiedStorageService.initialize()
   │       └─► Triggers syncFromCloud()
   │
   └─► syncFromCloud() process:
       │
       ├─► Lists all files in /Kinetix/runs on Google Drive
       │   └─► Finds: run_abc123.json
       │
       ├─► Downloads run_abc123.json
       │
       ├─► Checks local storage
       │   └─► run_abc123 not found locally
       │
       └─► Saves to local storage (SwiftData on iPhone)
           └─► User now sees the run on iPhone too!
```

## Sync Metadata: How We Track What's Synced

The system keeps track of what's been synced to avoid unnecessary uploads/downloads:

```javascript
// Sync metadata structure
{
  lastSync: "2025-01-15T10:30:00Z",
  syncMode: "cloud-synced",
  provider: "google",
  
  // Track each run's sync status
  syncedRuns: {
    "run_abc123": 1705315800000,  // Timestamp when synced
    "run_def456": 1705315900000,
  },
  
  // Device tracking
  deviceId: "web-uuid-123",
  lastDeviceSync: {
    "web-uuid-123": 1705315800000,
    "iphone-uuid-456": 1705316000000,
  }
}
```

**How it's used:**
- Before uploading: Check if run already synced and up-to-date
- Before downloading: Check if local version is newer than cloud
- Conflict detection: Compare timestamps to see which is newer

## Error Handling: What If Something Goes Wrong?

### Cloud Sync Fails

```
Scenario: Internet connection lost during cloud upload

1. Run saved to local ✅ (always succeeds)
2. Cloud upload fails ❌ (network error)

What happens:
├─► Local save succeeded (data is safe)
├─► Cloud sync error logged
├─► Run marked as "pending sync"
└─► Next time app opens: retries cloud sync automatically

Result: No data loss, sync retries later
```

### Token Expired

```
Scenario: Access token expired

1. App tries to sync to cloud
2. Gets "401 Unauthorized" error

What happens:
├─► Automatically tries to refresh token
│   └─► Uses refresh_token to get new access_token
├─► If refresh succeeds: Retries sync
└─► If refresh fails: Prompts user to re-authenticate

Result: Automatic recovery, seamless experience
```

### Conflict During Sync

```
Scenario: Same run edited on two devices

Device A: run_123, distance=5km, modified=10:00 AM
Device B: run_123, distance=6km, modified=10:05 AM

Sync process:
├─► Device A syncs: uploads run_123 (5km, 10:00)
├─► Device B syncs: uploads run_123 (6km, 10:05)
├─► Device A syncs again: downloads run_123
│   └─► Sees cloud version (6km, 10:05) is newer
│   └─► Replaces local with cloud version
└─► Both devices now have: run_123, distance=6km

Result: Both devices converge to same data (last-write-wins)
```

## Performance Optimizations

### Batch Operations

Instead of uploading one run at a time:
```javascript
// Bad: 10 separate API calls
for (const run of runs) {
  await uploadToCloud(run);
}

// Good: Batch upload
await uploadBatchToCloud(runs); // 1 API call
```

### Incremental Sync

Only sync what changed:
```javascript
// Check sync metadata
const lastSync = syncMetadata.lastSync; // "2025-01-15T10:00:00Z"

// Only sync runs modified after last sync
const runsToSync = localRuns.filter(run => 
  new Date(run.lastModified) > new Date(lastSync)
);
```

### Compression

Large route data is compressed:
```javascript
// Route data can be large (thousands of GPS points)
const routeData = run.routeData; // 50KB

// Compress before upload
const compressed = compress(routeData); // 5KB
await uploadToCloud(compressed);
```

## Security: How Tokens Are Protected

### Token Storage

```javascript
// Tokens are encrypted before storage
const encryptedToken = await encrypt(accessToken, encryptionKey);

// Stored in IndexedDB (encrypted)
await tokenStore.put({
  provider: 'google',
  accessToken: encryptedToken,  // Encrypted!
  refreshToken: encryptedRefreshToken,
  expiresAt: timestamp
});

// Encryption key derived from device ID (not stored)
const encryptionKey = deriveKey(deviceId);
```

### Token Refresh

```javascript
// Access tokens expire (usually 1 hour)
// Refresh tokens don't expire (until revoked)

if (token.expiresAt < now + 5 minutes) {
  // Refresh before it expires
  const newToken = await refreshAccessToken(refreshToken);
  await updateStoredToken(newToken);
}
```

## Summary: The Complete Picture

**Local Storage:**
- ✅ Primary source of truth
- ✅ Always available (offline)
- ✅ Fast reads/writes
- ✅ No network required

**Cloud Storage:**
- ✅ Backup and sync
- ✅ Cross-device access
- ✅ User's own account
- ✅ Automatic background sync

**UnifiedStorageService:**
- ✅ Coordinates both layers
- ✅ Handles sync automatically
- ✅ Resolves conflicts
- ✅ Works offline-first

**Result:**
- Fast, responsive app (local reads)
- Automatic backup (cloud sync)
- Cross-device access (cloud sync)
- Works offline (local storage)
- No data loss (local + cloud)

The system gives you the best of both worlds: the speed and reliability of local storage, with the backup and sync capabilities of cloud storage, all working together seamlessly!

