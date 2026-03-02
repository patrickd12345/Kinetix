# Strava → Kinetix Import (Last N Days) – Proven Steps

Use this procedure to pull your recent Strava runs (e.g., last 180 days) and load them into Kinetix. This flow matches the fixes we used (scope, code exchange, browser import).

## Prereqs
- Strava app with scope `activity:read_all`
- Node installed
- Repo at `/Users/patrickduchesneau/Projects/Kinetix/web`

## 1) Get a fresh Strava code (correct scope)
1. Open in a browser (localhost page will “fail”; that’s OK—copy the `code` query param):
```
https://www.strava.com/oauth/authorize?client_id=157217&response_type=code&redirect_uri=http://localhost:8080&approval_prompt=force&scope=activity:read_all
```
2. Copy the `code` value from the redirect URL.

## 2) Exchange code and export runs (e.g., 180 days)
```bash
cd /Users/patrickduchesneau/Projects/Kinetix/web

# clear old token so the code is used
unset STRAVA_ACCESS_TOKEN

export STRAVA_CLIENT_ID=157217
export STRAVA_CLIENT_SECRET=3652b26562c819e1a13ebb34e517e707dab939b2
export STRAVA_CODE=PASTE_CODE_HERE
export STRAVA_DAYS=180   # change as needed

node scripts/strava-import.js
```
This prints fresh tokens and writes `strava-runs-import.json` in `web/`.

Save the tokens for reuse:
```bash
export STRAVA_ACCESS_TOKEN="...printed_access_token..."
export STRAVA_REFRESH_TOKEN="...printed_refresh_token..."
unset STRAVA_CODE
```

## 3) Serve the export to the browser
```bash
cd /Users/patrickduchesneau/Projects/Kinetix/web
cp strava-runs-import.json public/
```

## 4) Import into Kinetix (browser console)
Start the app (`npm run dev`), open it in the browser, then run in DevTools console:
```js
const runs = await fetch('/strava-runs-import.json').then(r => r.json());
const { StorageService } = await import('/src/storage/local/storageService.js');
const { Run } = await import('/src/models/Run.js');
for (const runData of runs) {
  await StorageService.saveRun(Run.fromJSON(runData));
}
console.log('✅ Imported', runs.length, 'runs');
```

## Notes / Gotchas
- If you see 401 on activities, the token is missing `activity:read_all`; re-run the auth URL and use the new `code`.
- Tokens we last used (save securely):  
  `STRAVA_ACCESS_TOKEN=815e173f0fa49f32087421798b25bb042f80f49b`  
  `STRAVA_REFRESH_TOKEN=3bb0d38b67b1c05d917cb156c15cc59ac9accf19`
- PWA/Strava credential warnings in the app UI are harmless for import; to silence Strava warnings set `VITE_STRAVA_CLIENT_ID/SECRET` in `.env`.
