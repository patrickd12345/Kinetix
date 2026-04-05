# Kinetix web — Help Center implementation

This document tracks the **Kinetix web** Help Center against the **Bookiji Inc Shared Standards** Help Center Standard (`docs/BOOKIJI_INC_SHARED_STANDARDS.md` / Standard 9 in `docs/PLATFORM_STANDARDS.md` at the umbrella repo).

**Architecture (support RAG, fallback, tickets, reinjection):** see **[HELP_CENTER_ARCHITECTURE.md](./HELP_CENTER_ARCHITECTURE.md)** — implementation-oriented design for the next slices.

## Current state (web app)

| Standard expectation | Kinetix web status |
| -------------------- | ------------------ |
| Stable Help / Support entry point | **Done:** `Help` in main nav (header, sidebar, mobile bottom nav) → route `/help`. |
| AI-first when tier allows | **Partial:** Coach chat (`/chat`) linked as the primary AI path from Help Center; tier gating is unchanged from existing auth/entitlements. |
| Grounded curated support RAG | **Partial:** `apps/rag` has **`kinetix_support_kb`** + ingest/query; web `/help` calls **`querySupportKB`** (`src/lib/supportRagClient.ts`) → **`POST /support/kb/query`** when the RAG service is reachable (`VITE_RAG_SERVICE_URL` or localhost discovery). Shows **retrieval excerpts** only. Coach/run context remains **`kinetix_runs`**. |
| Deterministic fallback when retrieval empty / weak / service down | **Partial:** `src/lib/helpCenterFallback.ts` + Help Center panel labeled **Deterministic fallback** (not AI). Shown when RAG is unavailable, HTTP/query errors, empty KB results, or best match similarity &lt; `MIN_USEFUL_SIMILARITY` (0.15). Topic-keyed bullets (sync / import / kps) + “Always try”. |
| AI-controlled escalation; user confirms; structured ticket | **Partial:** No self-serve “open ticket” control. After unresolved search (low confidence, service error, empty results, second weak attempt, or user marks “still not resolved”), the UI proposes escalation; **`POST /support/ticket/create`** on the RAG service inserts into Supabase **`kinetix.support_tickets`** (`apps/rag/services/supportTicketCreate.js`). Optional **`VITE_SUPPORT_EMAIL`** opens mailto with the same JSON if the ticket API is unavailable. |
| Curated reinjection of resolved tickets into support RAG | **Deferred.** |
| Human support not default first line | **Aligned:** Help Center presents AI (Coach) and self-serve troubleshooting before escalation. |

## First slice shipped

- **Route:** `/help` (`src/pages/HelpCenter.tsx`).
- **Sections:** AI Help, **Search support articles** (KB retrieval + deterministic fallback + escalation proposal), Troubleshooting, FAQ, Team escalation, Known limitations.
- **Wiring:** `App.tsx` route; `Layout.tsx` nav item.

## Deferred (explicit)

- Automated bulk ingest / CI for **`support-corpus/support-artifacts.json`** (corpus exists; manual `POST /support/kb/ingest` per artifact still applies unless scripted).
- Full server-side ticketing lifecycle beyond the current Supabase row store (e.g. triage UI, SLA).
- Reinjection pipeline from resolved tickets to KB.
- Richer static content CMS or JSON-driven FAQ (current fallback is code-local only).

## Configuration

- Optional: `VITE_SUPPORT_EMAIL` — mailto fallback when ticket API fails; body is JSON (structured payload).
- Optional: `VITE_APP_VERSION` — included in legacy escalation payload helpers when set (build-time). Documented in `.env.example`.
- Optional: `VITE_RAG_SERVICE_URL` — base URL for the Kinetix RAG service (support KB, ticket create, run indexing). If unset in dev, the client probes `localhost:3001`–`3010` (same as `ragClient.ts`).

## Curated support corpus (ingest-ready)

Repo-grounded articles for **`kinetix_support_kb`** live under **`support-corpus/`** — see **[support-corpus/README.md](./support-corpus/README.md)** (`support-artifacts.json`, `build-corpus.mjs`, validation against `apps/rag/services/supportArtifact.js`).
