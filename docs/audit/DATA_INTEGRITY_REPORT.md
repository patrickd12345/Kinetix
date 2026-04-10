# Data integrity report

## Web persistence

- **IndexedDB / Dexie:** Run storage and settings (`src/lib/database.ts`, `src/store/settingsStore.ts`). Vitest includes store tests (e.g. Withings sync policy).
- **No SQL in app:** Client uses Dexie; server uses Supabase via API — aligns with migration discipline for server DB.

## KPS / core math

- **Contract tests:** `src/lib/kpsUtils.contract.test.ts`, `KPS_CONTRACT.md` (repo root).
- **Shared package:** `packages/core` — `chatMath.test.ts` and web re-exports.

## Sync & integrations

- **Strava:** Import + token refresh (`src/lib/strava.ts`, tests).
- **Withings:** Weight sync, OAuth (`src/lib/withings.test.ts`, integration tests).
- **RAG sync:** `Layout.tsx` startup sync to RAG — failure paths `.catch(() => {})` (silent) — see remediation.

## Race conditions & duplicates

- **Strava startup:** Guard ref `stravaSyncDoneRef` prevents duplicate sync attempts.
- **Support queue:** Server-side store tests (`api/_lib/supportQueueStore.test.ts`).

## Gaps

- **Multi-tab** IndexedDB conflicts not systematically tested.
- **Offline** run recording not covered by web E2E in this audit.

## Evidence

- Vitest **353 tests passed** including KPS, history filters, Garmin import, goal probability engines.
