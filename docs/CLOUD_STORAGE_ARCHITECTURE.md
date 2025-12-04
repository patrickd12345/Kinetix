# Cloud Storage Integration Architecture

## Executive Summary

This architecture enables users to link their personal cloud storage accounts (Google Drive, Dropbox, OneDrive) to store all Kinetix data directly in their own cloud space. This approach:

- ✅ **Minimizes app storage footprint** - Data lives in user's cloud, not app storage
- ✅ **User ownership** - Users control their data in their own accounts
- ✅ **Cross-platform sync** - Access data from Watch, iPhone, and Web
- ✅ **Privacy-first** - No intermediary servers, direct user-to-cloud connection
- ✅ **Backup & recovery** - Automatic cloud backup of all runs and settings

## Viability Assessment

### ✅ **Highly Viable** - Here's Why:

1. **Standard OAuth 2.0** - All major providers (Google, Dropbox, Microsoft) support OAuth 2.0 with well-documented APIs
2. **Platform Support**:
   - **Web**: Native OAuth redirect flows work perfectly
   - **iOS**: ASWebAuthenticationSession for secure OAuth
   - **Watch**: Delegates to iPhone for OAuth (Watch can't handle browser redirects)
3. **Storage APIs**: All providers offer robust file upload/download APIs
4. **Token Management**: iOS Keychain and Web secure storage handle tokens securely
5. **Data Format**: JSON files are small, efficient, and easy to sync

### Potential Challenges & Solutions:

| Challenge | Solution |
|-----------|----------|
| Watch can't do OAuth | iPhone handles OAuth, tokens sync to Watch via Watch Connectivity |
| Token refresh | Automatic refresh with exponential backoff |
| Offline sync conflicts | Last-write-wins with timestamps, merge strategy for settings |
| Large route data | Compress route data, incremental sync for large files |
| Multiple devices | Cloud storage acts as source of truth, devices sync on connect |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Cloud Storage                      │
│  (Google Drive / Dropbox / OneDrive)                        │
│                                                              │
│  /Kinetix/                                                   │
│    ├── runs/                                                │
│    │   ├── run_2025-01-15_abc123.json                      │
│    │   └── run_2025-01-16_def456.json                      │
│    ├── settings.json                                        │
│    ├── profile.json                                         │
│    ├── battery_profiles.json                                │
│    └── activities.json                                      │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ OAuth + API
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
│  Watch App   │  │  iPhone App  │  │   Web App    │
│              │  │              │  │              │
│  Local Cache │  │  OAuth Flow  │  │  OAuth Flow  │
│  (SwiftData) │  │  Token Store │  │  Token Store │
│              │  │  (Keychain)   │  │  (Secure)    │
│              │  │              │  │              │
│  Sync via    │  │  Cloud Sync  │  │  Cloud Sync  │
│  iPhone      │  │  Service     │  │  Service     │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Platform-Specific Design

### 1. **Web App** (Primary OAuth Handler)

**OAuth Flow:**
```
User clicks "Link Google Drive"
  → Redirect to Google OAuth consent screen
  → User authorizes
  → Redirect back to app with code
  → Exchange code for access_token + refresh_token
  → Store tokens securely (encrypted localStorage or IndexedDB)
  → Test connection by creating /Kinetix folder
  → Ready to sync
```

**Token Storage:**
- Encrypted tokens in IndexedDB (separate store: `cloud_tokens`)
- Encryption key derived from user interaction (not stored)
- Refresh tokens stored separately from access tokens

**Implementation:**
- Use OAuth 2.0 redirect flow
- Store tokens in secure IndexedDB store
- Background sync service runs periodically

### 2. **iPhone App** (Primary OAuth Handler for Watch)

**OAuth Flow:**
```
User opens Settings → Cloud Storage
  → Select provider (Google Drive, Dropbox, etc.)
  → ASWebAuthenticationSession opens
  → User authorizes in Safari
  → Callback URL handled by app
  → Exchange code for tokens
  → Store in iOS Keychain (most secure)
  → Sync tokens to Watch via Watch Connectivity
  → Test connection
  → Ready to sync
```

**Token Storage:**
- iOS Keychain (most secure option)
- Keychain items accessible only to app
- Automatic encryption by iOS

**Watch Connectivity:**
- iPhone receives OAuth tokens
- iPhone syncs tokens to Watch (encrypted via Watch Connectivity)
- Watch can then sync data via iPhone proxy OR directly if provider supports

### 3. **Watch App** (Delegates OAuth to iPhone)

**Limitations:**
- Cannot handle OAuth redirects (no browser)
- Limited network capabilities
- Battery constraints

**Solution:**
- Watch requests OAuth via iPhone
- iPhone handles OAuth flow
- Tokens synced to Watch via Watch Connectivity
- Watch syncs data through iPhone (proxy) OR directly if possible

## OAuth Authentication Flow

### High-Level Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. Clicks "Link Google Drive"
     ▼
┌─────────────────┐
│  App generates  │
│  OAuth URL with │
│  redirect_uri   │
└────┬────────────┘
     │ 2. Open browser/ASWebAuthenticationSession
     ▼
┌─────────────────┐
│  Provider OAuth  │
│  Consent Screen  │
└────┬────────────┘
     │ 3. User authorizes
     ▼
┌─────────────────┐
│  Redirect with  │
│  authorization  │
│  code           │
└────┬────────────┘
     │ 4. App receives code
     ▼
┌─────────────────┐
│  Exchange code  │
│  for tokens     │
│  (POST to token │
│   endpoint)     │
└────┬────────────┘
     │ 5. Receive access_token + refresh_token
     ▼
┌─────────────────┐
│  Store tokens   │
│  securely       │
└────┬────────────┘
     │ 6. Test connection
     ▼
┌─────────────────┐
│  Create /Kinetix│
│  folder if      │
│  needed         │
└─────────────────┘
```

### Provider-Specific OAuth Endpoints

#### Google Drive
- **Auth URL**: `https://accounts.google.com/o/oauth2/v2/auth`
- **Token URL**: `https://oauth2.googleapis.com/token`
- **Scopes**: `https://www.googleapis.com/auth/drive.file` (read/write to files created by app)
- **API Base**: `https://www.googleapis.com/drive/v3`

#### Dropbox
- **Auth URL**: `https://www.dropbox.com/oauth2/authorize`
- **Token URL**: `https://api.dropbox.com/oauth2/token`
- **Scopes**: `files.content.write files.content.read` (read/write files)
- **API Base**: `https://api.dropboxapi.com/2`

#### Microsoft OneDrive
- **Auth URL**: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- **Token URL**: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- **Scopes**: `Files.ReadWrite.AppFolder` (read/write to app folder)
- **API Base**: `https://graph.microsoft.com/v1.0`

## Token Management

### Token Storage Structure

```typescript
interface CloudToken {
  provider: 'google' | 'dropbox' | 'onedrive';
  accessToken: string;        // Encrypted
  refreshToken: string;        // Encrypted
  expiresAt: number;           // Timestamp
  tokenType: string;           // Usually "Bearer"
  scope: string;
  lastRefresh: number;         // Timestamp of last refresh
}
```

### Token Refresh Strategy

```javascript
async function ensureValidToken(provider) {
  const token = await getStoredToken(provider);
  
  // Refresh if expires in < 5 minutes
  if (token.expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const newToken = await refreshAccessToken(provider, token.refreshToken);
      await storeToken(provider, newToken);
      return newToken;
    } catch (error) {
      // Refresh failed - need re-authentication
      await clearToken(provider);
      throw new Error('Token refresh failed. Please re-authenticate.');
    }
  }
  
  return token;
}
```

### Security Measures

1. **Encryption at Rest**:
   - Web: Encrypt tokens before storing in IndexedDB
   - iOS: Keychain automatically encrypts
   - Watch: Encrypted via Watch Connectivity

2. **Token Scope Minimization**:
   - Request only necessary scopes
   - Use app-specific folders when available (e.g., Google Drive app folder)

3. **Token Rotation**:
   - Refresh tokens automatically
   - Invalidate on logout
   - Handle token revocation gracefully

## Data Storage Structure

### Cloud Folder Structure

```
/Kinetix/
├── runs/
│   ├── run_2025-01-15_abc123.json
│   ├── run_2025-01-16_def456.json
│   └── runs_index.json          # Manifest of all runs
├── settings.json                # App settings
├── profile.json                 # Runner profile
├── battery_profiles.json        # Battery profile configurations
├── activities.json              # Activity templates
└── sync_metadata.json           # Sync state, last sync time, etc.
```

### File Format Example

**run_2025-01-15_abc123.json:**
```json
{
  "id": "abc123",
  "date": "2025-01-15T10:30:00Z",
  "source": "watch",
  "distance": 5000,
  "duration": 1800,
  "avgPace": 360,
  "avgNPI": 142.5,
  "avgHeartRate": 165,
  "avgCadence": 180,
  "avgVerticalOscillation": 8.5,
  "avgGroundContactTime": 220,
  "avgStrideLength": 1.35,
  "formScore": 85,
  "routeData": [
    {"lat": 45.5017, "lon": -73.5673},
    {"lat": 45.5018, "lon": -73.5674}
  ],
  "formSessionId": "session-uuid",
  "syncedAt": "2025-01-15T10:35:00Z"
}
```

**settings.json:**
```json
{
  "targetNPI": 135.0,
  "unitSystem": "metric",
  "physioMode": false,
  "lastModified": "2025-01-15T10:00:00Z"
}
```

**sync_metadata.json:**
```json
{
  "lastSync": "2025-01-15T10:35:00Z",
  "deviceId": "iphone-uuid",
  "syncVersion": 1,
  "conflicts": []
}
```

## Sync Strategy

### Sync Modes

1. **Automatic Sync** (Background):
   - Periodic sync every 15 minutes when app is active
   - Sync on app launch
   - Sync after data changes (with debounce)

2. **Manual Sync**:
   - User-triggered sync button
   - Pull-to-refresh in history view

3. **Conflict Resolution**:
   - **Last-write-wins** for runs (timestamp-based)
   - **Merge strategy** for settings (combine non-conflicting changes)
   - User notification for conflicts requiring manual resolution

### Sync Flow

```
┌──────────────┐
│  Local Data  │
│  Changed     │
└──────┬───────┘
       │
       ▼
┌─────────────────┐
│  Check Cloud    │
│  Connection     │
└──────┬──────────┘
       │
       ├─ Connected → Sync to cloud
       │
       └─ Offline → Queue for later
                    └─ Sync when online
```

### Incremental Sync

- Only sync changed files (compare `lastModified` timestamps)
- Batch operations for multiple runs
- Compress route data for large runs
- Background sync doesn't block UI

## Implementation Components

### 1. Cloud Storage Service (Abstract Interface)

```typescript
interface CloudStorageProvider {
  // Authentication
  authenticate(): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  disconnect(): Promise<void>;
  
  // File Operations
  uploadFile(path: string, content: string): Promise<void>;
  downloadFile(path: string): Promise<string>;
  listFiles(folder: string): Promise<string[]>;
  deleteFile(path: string): Promise<void>;
  
  // Folder Operations
  createFolder(path: string): Promise<void>;
  folderExists(path: string): Promise<boolean>;
}
```

### 2. Provider Implementations

- `GoogleDriveProvider` - Implements CloudStorageProvider
- `DropboxProvider` - Implements CloudStorageProvider
- `OneDriveProvider` - Implements CloudStorageProvider

### 3. Sync Service

```typescript
class CloudSyncService {
  // Sync all data to cloud
  syncToCloud(): Promise<void>;
  
  // Sync from cloud to local
  syncFromCloud(): Promise<void>;
  
  // Sync specific run
  syncRun(runId: string): Promise<void>;
  
  // Check sync status
  getSyncStatus(): Promise<SyncStatus>;
}
```

### 4. UI Components

- **CloudStorageSettingsView**: Link/unlink providers, sync status
- **SyncIndicator**: Shows sync status in UI
- **ConflictResolutionDialog**: Handle sync conflicts

## Security Considerations

### 1. Token Security
- ✅ Encrypt tokens at rest
- ✅ Use secure storage (Keychain on iOS, encrypted IndexedDB on web)
- ✅ Never log tokens
- ✅ Automatic token refresh
- ✅ Token revocation on logout

### 2. Data Privacy
- ✅ Data stored in user's own cloud account
- ✅ No intermediary servers
- ✅ End-to-end encryption option (future enhancement)
- ✅ Minimal permissions requested

### 3. API Security
- ✅ HTTPS only
- ✅ Validate all API responses
- ✅ Handle API errors gracefully
- ✅ Rate limiting respect

## Error Handling

### Common Scenarios

1. **Token Expired**:
   - Automatically refresh
   - If refresh fails, prompt re-authentication

2. **Network Error**:
   - Queue sync operations
   - Retry with exponential backoff
   - Show user-friendly error message

3. **API Rate Limit**:
   - Respect rate limits
   - Queue requests
   - Show sync delay notification

4. **Storage Quota Exceeded**:
   - Alert user
   - Suggest cleanup options
   - Offer compression for old runs

5. **Conflict Detection**:
   - Compare timestamps
   - Show conflict resolution UI
   - Allow user to choose version

## Migration Strategy

### Existing Users

1. **Opt-in Migration**:
   - User chooses to enable cloud storage
   - Existing data remains in local storage
   - First sync uploads all existing data

2. **Gradual Migration**:
   - New data goes to cloud immediately
   - Old data migrates gradually in background
   - User can continue using app during migration

3. **Rollback Option**:
   - Keep local copy as backup
   - Allow disabling cloud storage
   - Data remains accessible locally

## Platform-Specific Implementation Notes

### Web App
- Use OAuth 2.0 redirect flow
- Store tokens in encrypted IndexedDB
- Use Service Worker for background sync
- Handle CORS for API calls

### iPhone App
- Use ASWebAuthenticationSession for OAuth
- Store tokens in iOS Keychain
- Background URLSession for sync
- Share tokens with Watch via Watch Connectivity

### Watch App
- Receive tokens from iPhone
- Sync data through iPhone proxy (recommended)
- OR sync directly if provider supports (future)
- Minimal local cache for offline access

## Testing Strategy

1. **OAuth Flow Testing**:
   - Test authentication for each provider
   - Test token refresh
   - Test token revocation

2. **Sync Testing**:
   - Test upload/download
   - Test conflict resolution
   - Test offline queue
   - Test large file handling

3. **Security Testing**:
   - Verify token encryption
   - Test token storage security
   - Verify API security

## Future Enhancements

1. **End-to-End Encryption**:
   - Encrypt data before uploading
   - User-controlled encryption keys

2. **Multiple Provider Support**:
   - Link multiple cloud accounts
   - Choose default provider
   - Sync to multiple providers

3. **Selective Sync**:
   - Choose what to sync (runs, settings, etc.)
   - Exclude large route data if needed

4. **Export Formats**:
   - Export to GPX/TCX formats
   - Share directly from cloud storage

## Conclusion

This architecture is **highly viable** and provides:

- ✅ Secure OAuth authentication
- ✅ User-owned data storage
- ✅ Cross-platform sync
- ✅ Minimal app storage footprint
- ✅ Privacy-first approach
- ✅ Standard, well-documented APIs

The modular design allows for easy addition of new cloud providers and maintains compatibility with existing local storage while providing seamless cloud backup and sync capabilities.

