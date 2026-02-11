# Web apps: one canonical, one legacy

There are two web-related trees in the repo. Only one is the main app.

## Canonical web app: `apps/web`

- **Location:** `apps/web/`
- **In workspace:** yes (`pnpm-workspace.yaml` → `apps/*`)
- **Root commands:** `pnpm dev` and `pnpm build` run this app.
- **Stack:** Vite, React, TypeScript, Dexie (IndexedDB), `@kinetix/core`.
- **Features:** Run dashboard, History, Settings, Strava OAuth import, Garmin ZIP import, NPI/baseline, RAG indexing client (calls external RAG service).
- **Use this for:** All new web work. This is the single web construction to extend.

## Legacy archive: `archive/web-legacy/`

- **Location:** `archive/web-legacy/`
- **In workspace:** no
- **Stack:** Vite, React, JS/JSX, PWA, its own storage and run models.
- **Contains:** Older UI (HistoryView, RunView, SettingsView), Strava scripts, ops/autonomy/sentry/sim, unified storage, and historical RAG setup docs.
- **Role:** Archived reference only. **Do not add new features here.**

## RAG

- **Backend:** `apps/rag/` (Express server, embedding + vector DB). Run with `pnpm --filter @kinetix/rag start`.
- **Client:** `apps/web` uses `src/lib/ragClient.ts` and calls the RAG service HTTP API.

## Summary

| Concern        | Use this        |
|----------------|-----------------|
| Web UI / flows | `apps/web`     |
| Garmin/Strava  | `apps/web`     |
| Run storage    | `apps/web` (Dexie) |
| RAG indexing   | `apps/web` (client) + `apps/rag` (server) |
| New features   | `apps/web` only |

This avoids duplicated construction: **one web app** (`apps/web`) plus one workspace RAG backend (`apps/rag`).
