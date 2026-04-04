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
| Ticket escalation when unresolved | **Partial:** `VITE_SUPPORT_EMAIL` enables `mailto:` escalation; structured **escalation payload** (query, inferred topic, retrieval state, fallback flag, surfaced KB chunk ids/titles, route, timestamp, optional user id, optional `VITE_APP_VERSION`) is embedded in the email body via `src/lib/helpCenterEscalation.ts`. **Contact support with this context** appears only after an unresolved support search (unavailable, error, empty, or weak retrieval). Not a submitted ticket. |
| Curated reinjection of resolved tickets into support RAG | **Deferred.** |
| Human support not default first line | **Aligned:** Help Center presents AI (Coach) and self-serve troubleshooting before contact. |

## First slice shipped

- **Route:** `/help` (`src/pages/HelpCenter.tsx`).
- **Sections:** AI Help, **Search support articles** (KB retrieval + deterministic fallback), Troubleshooting, FAQ, Ticket/contact, Known limitations.
- **Wiring:** `App.tsx` route; `Layout.tsx` nav item.

## Deferred (explicit)

- Automated bulk ingest / CI for **`support-corpus/support-artifacts.json`** (corpus exists; manual `POST /support/kb/ingest` per artifact still applies unless scripted).
- Server-side ticketing and ticket lifecycle.
- Reinjection pipeline from resolved tickets to KB.
- Richer static content CMS or JSON-driven FAQ (current fallback is code-local only).

## Configuration

- Optional: `VITE_SUPPORT_EMAIL` — enables mailto in Help Center; unresolved flows also show context-rich mailto.
- Optional: `VITE_APP_VERSION` — included in escalation payload when set (build-time). Documented in `.env.example`.
- Optional: `VITE_RAG_SERVICE_URL` — base URL for the Kinetix RAG service (support KB + run indexing). If unset in dev, the client probes `localhost:3001`–`3010` (same as `ragClient.ts`).

## Curated support corpus (ingest-ready)

Repo-grounded articles for **`kinetix_support_kb`** live under **`support-corpus/`** — see **[support-corpus/README.md](./support-corpus/README.md)** (`support-artifacts.json`, `build-corpus.mjs`, validation against `apps/rag/services/supportArtifact.js`).
