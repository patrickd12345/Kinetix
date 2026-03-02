# Scripts Directory

Utility scripts for Kinetix web app.

## strava-import.js

One-shot import of Strava runs into Kinetix database.

**Usage:**
```bash
# Set credentials
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret
export STRAVA_DAYS=180 # optional, limit to last N days (omit for all)

# Run import
node scripts/strava-import.js
```

See `STRAVA_IMPORT.md` for full instructions.

## strava-import-browser.js

Browser-side import script. Run in browser console after generating the JSON file.

**Usage:**
1. Run `strava-import.js` to generate `strava-runs-import.json`
2. Copy JSON to `public/` folder
3. Open web app in browser
4. Open console (F12)
5. Copy and paste `strava-import-browser.js` code
6. Run: `importStravaRuns()`

## strava-to-googledrive.js

Export last 90 days of Strava runs directly to Google Drive.

**Usage:**
```bash
# Set credentials
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_CLIENT_SECRET=your_google_client_secret

# Run export
node scripts/strava-to-googledrive.js

# Run tests (converter + token flows)
npm test
```

See `STRAVA_TO_GOOGLEDRIVE.md` for full instructions.

## export-runs.js

Export runs from browser IndexedDB to JSON.

**Usage:**
- Run in browser console
- Or use as bookmarklet
- Downloads runs as JSON file





