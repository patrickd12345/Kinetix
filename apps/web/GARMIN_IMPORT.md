# Garmin Export Import

Import 11+ years of Garmin running data from a Garmin export ZIP into the web app.

## Where the data lives in the ZIP

The Garmin export ZIP contains many product folders. **Only** this path is scanned:

- `DI_CONNECT/DI-Connect-Fitness/`

Files must match: `*_summarizedActivities.json`. Only activities with `activityType.typeKey === "running"` are imported.

## How to run the import

### Option 1: In the app (recommended)

1. Open the web app and go to **Settings**.
2. In the **Garmin export** section, click **Import Garmin ZIP**.
3. Select your `garmin.zip` file.
4. Runs are deduplicated by Garmin `activityId`; re-importing the same ZIP will not create duplicates.

### Option 2: CLI (output JSON for later load)

From the repo root, with `garmin.zip` in the current directory (or pass a path):

```bash
cd apps/web
pnpm garmin:import [path/to/garmin.zip] [output.json]
```

Default: reads `garmin.zip` from the current directory and writes `garmin-runs.json`. The script only extracts and normalizes; it does not write to the app database. To get runs into the app, use Option 1 (select the ZIP in Settings) or load the generated JSON via a future "Import from file" flow.

## Validation

The importer logs:

- Files scanned (only `DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json`)
- Total activities parsed (all sports)
- Running activities found
- Duplicates skipped (by `activityId`)
- Runs imported (or written to JSON)

If the JSON structure of a file does not match expectations (e.g. not an array, or missing `activityType.typeKey`), the importer fails with a clear error.

## RAG indexing

After import (and after any new run or Strava import), runs are indexed into the RAG service when it is available (`VITE_RAG_SERVICE_URL`, default `http://localhost:3001`). Indexing is best-effort and does not block the UI.
