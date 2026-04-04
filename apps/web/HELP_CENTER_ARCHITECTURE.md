# Kinetix Help Center — support architecture (design)

**Scope:** Kinetix web Help Center path (`/help`, future support-aware flows). **Status:** design — not fully implemented. Aligns with Bookiji Inc Help Center Standard (umbrella `docs/BOOKIJI_INC_SHARED_STANDARDS.md`).

**Existing stack (facts today):**

- Run/coach RAG uses `apps/rag` with Chroma collection **`kinetix_runs`** (`apps/rag/services/vectorDB.js`). Embeddings index **runs** for similarity and coach context — not support articles.
- Coach chat (`useChat`) builds context from **run RAG** + calls **`/api/ai-chat`** (Kinetix API). There is **no** support KB retrieval yet.

This document defines how **curated support** layers on without mixing into run data.

---

## A. Support artifact model

A **curated support artifact** is the unit of knowledge approved for retrieval (and eventual embedding). It is **not** a raw ticket, log dump, or user message.

### Required fields (logical schema)

| Field | Purpose |
| ----- | ------- |
| `artifact_id` | Stable string UUID or slug (`support-entitlements-strava-oauth`, etc.). |
| `title` | Short human title for UI and chunk headers. |
| `body_markdown` | Canonical content (Markdown). This is what gets chunked. |
| `version` | Monotonic int or semver for invalidation when content changes. |
| `locale` | e.g. `en` (default for v1). |
| `product` | Always `kinetix` for this product-local KB. |
| `surface` | `web` for web-specific copy; `all` when applies to every client. |
| `classification` | See tagging below — at least one **topic** and one **intent**. |
| `review_status` | `draft` \| `approved` \| `deprecated`. Only **`approved`** may be embedded for production retrieval. |
| `source_type` | `editorial` \| `ticket_resolution` \| `faq` (provenance for reinjection). |
| `created_at` / `updated_at` | ISO timestamps. |
| `reviewed_by` / `reviewed_at` | Optional; required for `source_type=ticket_resolution` before promotion to `approved`. |

### Chunking expectations

- **Input:** `body_markdown` normalized to plain text or normalized Markdown per pipeline choice.
- **Target size:** ~400–900 tokens per chunk (tune with embedding model context); **overlap** ~50–100 tokens between adjacent chunks so list/table steps are not split blindly.
- **Chunk metadata (per chunk):** `artifact_id`, `version`, `chunk_index`, `title` (denormalized for citation), `classification` (same as artifact), `product`, `surface`.
- **Idempotency:** chunk document ids = `{artifact_id}:v{version}:{chunk_index}` so re-ingestion replaces prior vectors for that version.

### Tagging / classification

Minimum viable taxonomy for retrieval filtering and analytics:

- **topic:** `account` \| `billing` \| `sync` \| `import` \| `kps` \| `charts` \| `privacy` \| `general`
- **intent:** `howto` \| `troubleshoot` \| `policy` \| `limitation`
- **optional facets:** `integration:strava` \| `integration:withings` \| `integration:garmin` when the article is integration-specific.

Queries from Help/support flows should pass **topic + optional integration** into retrieval filters when known (e.g. user on Settings > Strava → bias `sync` + `integration:strava`).

---

## B. RAG strategy

### Dedicated collection / store

- **Yes — separate from runs.** Use a **distinct Chroma collection**, e.g. **`kinetix_support_kb`** (name is illustrative; implement alongside `kinetix_runs` in `apps/rag` or equivalent service module).
- **Never** add support chunks into `kinetix_runs`. That collection’s metadata and distance semantics are run-specific; mixing pollutes similarity search and coach context.

**Implemented (`apps/rag`):** Chroma collection **`kinetix_support_kb`** (`services/supportVectorDB.js`). Ingest/query HTTP routes: **`POST /support/kb/ingest`**, **`POST /support/kb/query`**, **`GET /support/kb/stats`**. Run endpoints and **`kinetix_runs`** are unchanged. Artifact validation: `services/supportArtifact.js` (approved-only ingest, explicit fields — no ticket dump path).

### Separation from run-analysis data

| Concern | Run RAG (`kinetix_runs`) | Support RAG (`kinetix_support_kb`) |
| ------- | ------------------------ | ----------------------------------- |
| Content | Run metrics, dates, KPS-related text | Curated articles, FAQs, approved resolutions |
| Callers | `/similar`, `/analyze`, coach context | Help Center Q&A, support assistant (future) |
| User scoping | Effectively per-runner via app context | **Global KB** (same articles for all users); optional future per-tenant only if product requires |

### Retrieval — practical high level

1. **Query:** user question (and optional structured hints: `topic`, `integration` from current UI).
2. **Embed** query with the **same embedding model** as support chunks (keep parity with `apps/rag` / `EmbeddingService` conventions).
3. **Query Chroma** on `kinetix_support_kb` with `where` filters on `review_status == approved`, `product == kinetix`, and optional classification filters.
4. **Top-k** (e.g. k=5–8), **score threshold** T — if best score < T, treat as **low confidence** (see deterministic fallback).
5. **Prompt:** inject retrieved chunk text with **citations** (`title`, `artifact_id`, `chunk_index`) into a support-specific system prompt; **forbid** inventing facts outside retrieved chunks for factual claims.

Coach chat may remain **run-grounded** until product decision merges flows; Help-specific assistant is a **separate entry** or mode when implemented.

---

## C. Deterministic fallback

Fallback must be **rule-based** and **does not** claim AI inference when disabled.

| Condition | Behavior |
| --------- | -------- |
| **AI unavailable** (API error, model down, timeout) | Show static **Help Center** sections (already on `/help`); link to **Troubleshooting** (Settings); optional **retry** for chat. No LLM call. |
| **AI disallowed by tier / entitlement** | Same as above; optionally show short **“Upgrade / check access”** copy if product adds a paid AI tier — gated by existing entitlement flags from API. |
| **Low confidence** (no chunk above threshold, or empty retrieval) | Show **curated FAQ excerpts** or **topic links** from a **bundled static map** (JSON or MD in web app) keyed by `topic`; **do not** synthesize from runs. Second line: **mailto** / ticket CTA with preserved context (see D). |
| **Fallback sources (priority order)** | (1) Static `/help` copy and in-app **topic FAQ** bundle. (2) **Approved** support RAG chunks if retrieval succeeded but LLM failed — can show “Suggested articles” list without generation. (3) **Escalation** (email/ticket). |

“Low confidence” for an **LLM** path: if the model returns empty or a sentinel, still prefer deterministic content over hallucination.

---

## D. Ticket escalation path

**Today:** `mailto:` via `VITE_SUPPORT_EMAIL` with prefilled subject and body built by **`src/lib/helpCenterEscalation.ts`** (`buildSupportEscalationPayload`, `formatEscalationBodyPlain`, `buildEscalationMailtoHref`). The UI shows **Contact support with this context** inside the deterministic fallback block when a support search did not resolve the issue (service down, query error, empty KB, or weak similarity). Honest copy: not a submitted ticket.

**Target minimum context** (must be preserved so the user does not restart from zero):

| Field | Required | Notes |
| ----- | -------- | ----- |
| `user_id` (opaque) | Yes | From auth session — never raw PII in client logs. |
| `product` | Yes | `kinetix` |
| `surface` | Yes | `web` |
| `app_version` / build | If available | From env or `import.meta.env` |
| `last_route` | Yes | e.g. `/help`, `/settings` |
| `topic` | Recommended | User-selected or inferred (sync, billing, …) |
| `summary` | Yes | Short user-written description (required before send). |
| `ai_transcript_summary` | Optional | If user used AI first: last N messages hashed or truncated — **no** secrets; **no** full health data unless user pasted it. |
| `rag_artifact_ids` | Optional | If RAG suggested articles, list ids for support triage. |

**Data that must not** travel without explicit user consent: full run GPS, raw health exports, tokens. **Support bundle** = structured metadata + user narrative only.

Future **ticketing API** should accept the same JSON shape; mailto can embed a compressed query param or short id referencing a **server-stored** draft if implemented later.

---

## E. Reinjection path

**Curate before reinjection:** a resolved ticket becomes a **draft artifact** with `source_type=ticket_resolution`. A human (or governed workflow) **edits** PII, generalizes steps, and sets `review_status=approved`.

| Must **never** be blindly reinjected | Why |
| ------------------------------------ | --- |
| Raw ticket thread | PII, one-off data, anger, duplicates |
| Stack traces / internal logs | Noise, security |
| User-specific metrics (KPS, weight) | Not reusable KB unless anonymized case study |
| Unverified AI replies | Hallucination risk |

**Resolved → reusable knowledge:**

1. Extract **steps that worked** → Markdown article.
2. Assign **classification** and **title**.
3. **Review** → `approved`.
4. **Ingest** via **`POST /support/kb/ingest`** into `kinetix_support_kb` with new `version` / chunk ids.
5. **Audit log** (future): link `artifact_id` ↔ original ticket id for compliance.

---

## F. Next implementation slices (ordered)

1. ~~**Support KB collection + ingest/query (apps/rag)**~~ — **Done:** `kinetix_support_kb`, **`POST /support/kb/ingest`**, **`POST /support/kb/query`**, **`GET /support/kb/stats`**, validation in `services/supportArtifact.js`. **Corpus:** `apps/web/support-corpus/` (`support-artifacts.json`, `build-corpus.mjs`, `README.md`) — broad repo-grounded articles; regenerate + validate before bulk ingest.
2. ~~**Web: support context client**~~ — **Done:** `src/lib/supportRagClient.ts` (`querySupportKB` → **`POST /support/kb/query`**), **`HelpCenter.tsx`** “Search support articles” + quick prompts; graceful fallback when RAG unavailable.
3. ~~**Deterministic fallback bundle (web)**~~ — **Done:** `src/lib/helpCenterFallback.ts` (topic inference, `MIN_USEFUL_SIMILARITY`, `getDeterministicFallbackSections`); Help Center shows **Deterministic fallback** panel when RAG unavailable, query error, empty results, or weak similarity. Not wired to Coach chat yet.
4. ~~**Escalation payload**~~ — **Done (web):** `helpCenterEscalation.ts` + Help Center mailto handoff with structured plain-text body; no server ticket API.

**Best immediate next slice:** server-stored draft / ticketing API that accepts the same JSON shape (optional), or richer FAQ CMS.

---

## References (Kinetix repo)

- `apps/rag/services/vectorDB.js` — `kinetix_runs` collection
- `apps/rag/services/supportVectorDB.js` — `kinetix_support_kb` collection
- `apps/rag/README.md` — Chroma / embedding env
- `apps/web/src/lib/ragClient.ts` — coach/RAG HTTP client; exports **`getRAGBaseUrl`**
- `apps/web/src/lib/supportRagClient.ts` — support KB query client (`POST /support/kb/query`)
- `apps/web/src/lib/helpCenterFallback.ts` — deterministic fallback when retrieval is empty, weak, or service unavailable
- `apps/web/src/lib/helpCenterEscalation.ts` — escalation payload + mailto formatting for unresolved support search
- `apps/web/src/hooks/useChat.ts` — coach chat + `/api/ai-chat`
- `apps/web/HELP_CENTER.md` — shipped UI slice status
