# Scripts Directory

Utility scripts for Kinetix web app.

## strava-import.js

One-shot import of Strava runs into Kinetix database.

**Usage:**
```bash
# Set credentials
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret

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

## export-runs.js

Export runs from browser IndexedDB to JSON.

**Usage:**
- Run in browser console
- Or use as bookmarklet
- Downloads runs as JSON file







