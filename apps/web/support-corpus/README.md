# Kinetix web — curated support KB corpus

**Purpose:** Repo-grounded support articles for ingestion into the RAG collection **`kinetix_support_kb`** (`apps/rag`). Not marketing copy — written for retrieval and triage.

## Files

| File | Role |
| ---- | ---- |
| `build-corpus.mjs` | Source of truth: edit artifacts here, then regenerate JSON. |
| `support-artifacts.json` | Generated array of artifacts (committed for review and diffing). |
| `validate-corpus.mjs` | Runs `validateSupportArtifactForIngest` from `apps/rag/services/supportArtifact.js`. |
| `ingest-corpus.mjs` | Bulk POST each artifact to `POST /support/kb/ingest` on a configurable RAG base URL. |

## Artifact format

Each object matches **`POST /support/kb/ingest`** body field `artifact` (see `apps/rag/README.md`):

- `artifact_id` — slug-safe unique id
- `title`, `body_markdown`, `version` (≥ 1)
- `review_status`: `"approved"` only in this corpus
- `topic`: `account` \| `billing` \| `sync` \| `import` \| `kps` \| `charts` \| `privacy` \| `general`
- `intent`: `howto` \| `troubleshoot` \| `policy` \| `limitation`
- `source_type`: `editorial` \| `ticket_resolution` \| `faq` (this corpus uses **`editorial`**)
- `product`: `kinetix`, `locale`, `surface` (typically `web`)

## Review expectations

Before production ingest:

1. Re-read each article against current code paths (file references in **Source** lines are intentional).
2. Bump `version` when content changes materially (re-ingestion uses artifact id + version semantics in chunk ids per `HELP_CENTER_ARCHITECTURE.md`).
3. Remove or rewrite anything that becomes inaccurate after a refactor.

## How to regenerate and validate

From `products/Kinetix`:

```bash
node apps/web/support-corpus/build-corpus.mjs
node apps/web/support-corpus/validate-corpus.mjs
```

## Bulk ingest (automation)

1. Start the RAG service (`apps/rag`, default **http://localhost:3001**). Ensure Chroma/embeddings are available per `apps/rag/README.md`.
2. Validate the corpus (recommended):

   ```bash
   node apps/web/support-corpus/validate-corpus.mjs
   ```

3. Ingest all artifacts:

   ```bash
   cd apps/web
   pnpm support-corpus:ingest
   ```

   Or with an explicit base URL:

   ```bash
   KINETIX_RAG_BASE_URL=http://localhost:3001 node apps/web/support-corpus/ingest-corpus.mjs
   node apps/web/support-corpus/ingest-corpus.mjs --base-url=http://localhost:3001
   ```

   Optional: `--corpus=/absolute/or/relative/path/to/support-artifacts.json` (default: `support-artifacts.json` next to the script).

**Behavior:** Each array entry is sent unchanged as `{"artifact": <object>}`. The script prints **OK** / **FAIL** per `artifact_id`, a final summary, and exits **1** if any request fails. This touches **only** the support KB ingest path — not run indexing.

**Single-artifact debug** (manual):

```bash
curl -s -X POST http://localhost:3001/support/kb/ingest -H "Content-Type: application/json" -d "{\"artifact\":{\"artifact_id\":\"support-strava-sync\",\"title\":\"Strava\",\"body_markdown\":\"Open Settings and connect Strava OAuth.\",\"version\":1,\"review_status\":\"approved\",\"topic\":\"sync\",\"intent\":\"howto\",\"source_type\":\"editorial\"}}"
```

## Corpus provenance

Articles were drafted from **Kinetix-only** sources: `apps/web/**`, `apps/rag/**`, `api/**` (billing route), `docs/deployment/*` (Stripe entitlements, env), `FEATURES_WEB.md`, `PRODUCT_SCOPE.md`, `STRAVA_OAUTH_SETUP.md`, `HELP_CENTER*.md`, and related architecture docs. **No** Bookiji umbrella product behavior is asserted except where Kinetix explicitly integrates (e.g. shared Supabase, webhook path documented in-repo).
