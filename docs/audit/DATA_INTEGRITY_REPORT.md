# Kinetix Data Integrity Report

Audit date: 2026-04-11

## Data Stores

Dexie `KinetixDB` version 8 tables:
- `runs`
- `pb`
- `weightHistory`
- `providerConnections`
- `providerSyncCheckpoints`
- `providerSyncRuns`
- `providerRawEvents`
- `healthMetrics`

Server/Supabase data:
- Support tickets, notification metadata, KB approval bin, Stripe outbox/ledger, platform profiles/entitlements, audit/access logs, and extensive historical migrations.

## Findings

| ID | Severity | Evidence | Finding |
|---|---|---|---|
| DATA-01 | P1 | `History.tsx` calls `db.runs.delete(id)` while `database.ts` provides `hideRun(runId)` that clears PB if needed. | Deleting a PB run from History can leave stale PB references and bypass logical-delete semantics. |
| DATA-02 | P1 | `runStore.ts` saves a run asynchronously, then separately updates PB and indexes RAG without transaction/rollback. | Save, PB update, and RAG indexing can diverge on partial failure. |
| DATA-03 | P2 | `strava.ts` deduplicates by `${date}-${rounded distance}` among visible Strava runs. | Duplicate detection can miss same activity after hard delete or date precision drift; should prefer external ID. |
| DATA-04 | P2 | `bulkPutWeightEntries` reports `count: entries.length` even when `put` overwrites existing `dateUnix`. | UI may over-report newly written weight entries. |
| DATA-05 | P2 | `appendProviderRawEvents` uses `bulkAdd` with deterministic ids. | Duplicate raw events can throw unless caller deduplicates perfectly. |
| DATA-06 | P2 | `getWeightAtDate` does full date-range scan and reduce. | Correct for small data, but heavy weight history can become slow; use indexed reverse query. |
| DATA-07 | P3 | Withings sync tests cover idempotent canonical metrics and partial stream failure. | Good coverage for canonical metrics; raw event duplicate behavior still needs explicit test. |

## Positive Controls

- PB/KPS contract tests passed.
- Withings normalization/sync/idempotency tests passed.
- Strava conversion tests reject zero distance/duration.
- Support queue store and RAG ticket tests cover status transitions, invalid payloads, and storage failures.

