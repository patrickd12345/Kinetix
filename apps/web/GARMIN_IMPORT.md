# Garmin Export Import

Import Garmin running data from a **full account export ZIP**, a **ZIP that only contains `.fit` files**, or a **single `.fit` activity** into the web app.

## Where the data lives

**Summarized JSON (full export)**  
The full Garmin export ZIP contains many product folders. Summarized running lists are read from:

- `DI_CONNECT/DI-Connect-Fitness/`

Files must match: `*_summarizedActivities.json`. Only activities with `activityType.typeKey === "running"` are imported.

**FIT files**  
Any `*.fit` entry anywhere in a ZIP is parsed (running sessions only). A single `.fit` file can also be uploaded or passed to the CLI.

Imports from JSON and FIT are **merged** and **deduplicated** by stable `external_id` (Garmin activity id from JSON; `fit-…` from FIT).

## How to run the import

### Option 1: In the app (recommended)

1. Open the web app and go to **Settings**.
2. In the **Garmin export** section, use **Import Garmin (ZIP or .fit)**.
3. Select a full export ZIP, a ZIP containing `.fit` files, or one running `.fit` file.
4. Re-importing overlapping data will not create duplicate runs when IDs match.

### Option 2: CLI (output JSON for later load)

From `apps/web` (or pass paths):

```bash
cd apps/web
pnpm garmin:import [path/to/garmin.zip|.fit] [output.json]
```

Defaults: reads `garmin.zip` in the current directory and writes `garmin-runs.json`.

- **ZIP**: Reads summarized JSON under `DI_CONNECT/...` and every `*.fit` in the archive.
- **`.fit`**: Parses that file only.

The script only extracts and normalizes; it does not write to the app database. To load runs into the app, use Option 1 or load the generated JSON via a future “Import from file” flow.

## Validation

The CLI prints:

- **ZIP**: summarized JSON file count, FIT file count, raw activity row count from JSON, duplicate IDs skipped, normalized runs written.
- **`.fit`**: input path and run count written.

If the JSON structure does not match expectations or a FIT file cannot be parsed, the importer exits with an error.

## RAG indexing

After import (and after any new run or Strava import), runs are indexed into the RAG service when it is available (`VITE_RAG_SERVICE_URL`, default `http://localhost:3001`). Indexing is best-effort and does not block the UI.
