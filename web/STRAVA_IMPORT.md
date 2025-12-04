# Strava Import Guide

One-shot import of your Strava runs into Kinetix database.

## Quick Start

### 1. Get Strava API Credentials

1. Go to: https://www.strava.com/settings/api
2. Click "Create App"
3. Fill in:
   - **Application Name**: Kinetix Import
   - **Category**: Other
   - **Website**: http://localhost:8080
   - **Authorization Callback Domain**: localhost
4. Save your **Client ID** and **Client Secret**

### 2. Get Access Token

**Option A: OAuth Flow (Recommended)**

1. Set environment variables:
```bash
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret
```

2. Run the import script:
```bash
cd web
node scripts/strava-import.js
```

3. Follow the OAuth instructions shown. You'll need to:
   - Visit the Strava authorization URL
   - Authorize the app
   - Get the authorization code
   - Set `STRAVA_CODE=your_code` and run again

**Option B: Direct Access Token**

If you already have an access token:
```bash
export STRAVA_ACCESS_TOKEN=your_access_token
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret
node scripts/strava-import.js
```

### 3. Import Runs

The script will:
1. ✅ Fetch all your Strava activities
2. ✅ Filter for running activities
3. ✅ Convert to Kinetix Run format
4. ✅ Calculate NPI for each run
5. ✅ Export to `strava-runs-import.json`

### 4. Load into Web App

**Option A: Browser Console (Easiest)**

1. Copy `strava-runs-import.json` to `web/public/`
2. Open web app: `http://localhost:5173`
3. Open browser console (F12)
4. Copy and paste the code from `scripts/strava-import-browser.js`
5. Run: `importStravaRuns()`

**Option B: Manual Import**

1. Open browser console
2. Load the JSON:
```javascript
const response = await fetch('/strava-runs-import.json');
const runs = await response.json();
```

3. Import:
```javascript
const { StorageService } = await import('/src/services/storageService.js');
const { Run } = await import('/src/models/Run.js');

for (const runData of runs) {
  const run = Run.fromJSON(runData);
  await StorageService.saveRun(run);
}
console.log('✅ Imported', runs.length, 'runs');
```

## What Gets Imported

For each Strava run:
- ✅ **Distance** (meters)
- ✅ **Duration** (seconds)
- ✅ **Date/Time**
- ✅ **Average Pace** (calculated)
- ✅ **NPI** (calculated from distance and pace)
- ✅ **Heart Rate** (if available)
- ✅ **Cadence** (if available, converted to strides/min)
- ✅ **Elevation Gain** (as metadata)
- ✅ **Strava ID** (for reference)

## Limitations

- **Route Data**: Not imported by default (large files)
  - Set `FETCH_DETAILS=true` to fetch route data for first 5 runs
- **Form Metrics**: Not available from Strava
- **Rate Limiting**: Strava allows 600 requests per 15 minutes
  - Script includes delays to respect limits

## Troubleshooting

### "Missing Strava API credentials"
- Make sure you've set `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`
- Get them from: https://www.strava.com/settings/api

### "Token exchange failed"
- Make sure your authorization code is fresh (expires quickly)
- Check that your redirect URI matches your app settings

### "Failed to load strava-runs-import.json"
- Make sure the file is in `web/public/` directory
- Or serve it via your dev server

### "Rate limit exceeded"
- Wait 15 minutes and try again
- Or fetch in smaller batches (set `maxPages` option)

## Advanced Options

### Fetch Detailed Data

To include route data for some runs:
```bash
FETCH_DETAILS=true node scripts/strava-import.js
```

### Limit Number of Runs

To import only recent runs:
```javascript
// Edit strava-import.js
const activities = await fetchActivities(accessToken, {
  perPage: 200,
  maxPages: 5, // Only first 5 pages (1000 runs)
});
```

### Filter by Date

Edit the script to filter activities:
```javascript
const runs = convertToRuns(activities).filter(run => {
  const runDate = new Date(run.date);
  const cutoff = new Date('2024-01-01');
  return runDate >= cutoff;
});
```

## After Import

1. **Index in RAG** (optional):
   - Go to Settings
   - Click "Index Runs for RAG"
   - Index all runs for enhanced AI analysis

2. **Verify Import**:
   - Check History view
   - All Strava runs should appear
   - NPI should be calculated correctly

3. **Clean Up**:
   - Delete `strava-runs-import.json` if desired
   - Or keep it as backup

## Security Notes

- ⚠️ **Never commit** your Strava credentials to git
- ⚠️ **Access tokens expire** - use refresh tokens for long-term access
- ⚠️ **Store tokens securely** - use environment variables or a secrets manager

## Example Output

```
🏃 Strava Import Script
=======================

✅ Token obtained
   Access token: abc123...
   Refresh token: xyz789...

📥 Fetching activities from Strava...
   Fetched page 1: 200 activities (200 total)
   Fetched page 2: 200 activities (400 total)
   Fetched page 3: 150 activities (550 total)

✅ Fetched 550 total activities

🔄 Converting activities to runs...
✅ Converted 523 runs

💾 Exported 523 runs to: /path/to/strava-runs-import.json

📋 Next Steps:
==============

1. Open your web app in browser
2. Open browser console (F12)
3. Run the import code...
```

---

**Ready to import your Strava runs?** 🚀

