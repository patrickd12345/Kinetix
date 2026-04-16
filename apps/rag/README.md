# Kinetix RAG Service

`apps/rag` serves two separate retrieval surfaces:

- Run analysis and coach context in `kinetix_runs`
- Curated Help Center support content in `kinetix_support_kb`

The collections stay separate. Support articles and ticket-derived drafts must never be mixed into run embeddings.

## Run

```bash
cd apps/rag
pnpm install
pnpm start
```

Default local URL: `http://localhost:3001`

## Tests

```bash
pnpm test
```

## Environment

Core runtime:

- `PORT`
- `KINETIX_LLM_PROVIDER`
- `OLLAMA_API_URL` / `OLLAMA_BASE_URL`
- `OLLAMA_MODEL` / `LLM_MODEL` (chat / LLM only)
- `OLLAMA_EMBED_MODEL` / `KINETIX_OLLAMA_EMBEDDING_MODEL` / `EMBEDDING_MODEL` / `OLLAMA_EMBEDDING_MODEL` — Ollama model for `/api/embed` (RAG). Defaults to `nomic-embed-text`; do not set this to the same value as the chat model unless that model supports embeddings.
- `AI_GATEWAY_BASE_URL`
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_MODEL`
- `CHROMA_MODE`
- `CHROMA_PATH`
- `CHROMA_SERVER_URL` / `CHROMA_API_URL`
- `CHROMA_AUTO_START`
- `CHROMA_DOCKER_IMAGE`
- `OLLAMA_AUTO_START`

Supabase storage:

- `SUPABASE_URL` or `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`

Support queue and notification flow:

- `KINETIX_APP_BASE_URL`
- `KINETIX_SUPPORT_SLACK_WEBHOOK_URL`
- `KINETIX_SUPPORT_EMAIL_TO`
- `KINETIX_SUPPORT_EMAIL_FROM`
- `RESEND_API_KEY`

Ops-only legacy status route:

- `KINETIX_SUPPORT_OPS_SECRET`

## API

Run endpoints:

- `GET /health`
- `GET /available`
- `POST /index`
- `POST /similar`
- `POST /analyze`
- `GET /indexed-ids`
- `GET /stats`
- `POST /coach-context`

Curated support KB:

- `POST /support/kb/ingest`
- `POST /support/kb/query`
- `GET /support/kb/stats`

Structured Help Center ticket creation:

- `POST /support/ticket/create`

Legacy ops-only status mutation:

- `PATCH /support/ticket/:ticketId/status`

## Ticket-authoritative behavior

`POST /support/ticket/create` is the canonical write path for Help Center escalations.

Expected request shape:

- `product: "kinetix"`
- `timestamp`
- `issueSummary`
- `environment: "web"`
- optional `userId`
- `conversationExcerpt`
- `attemptedSolutions`
- optional `severity`
- optional `metadata`

Persistence rules:

1. Validate request.
2. Insert one row into `kinetix.support_tickets`.
3. Only after insert succeeds, fan out Slack and email notifications.
4. Update per-channel notification fields on the ticket row.
5. If notifications fail, keep the ticket and record channel failure state.

Notification status fields on `kinetix.support_tickets`:

- `notification_slack_status`
- `notification_email_status`
- `notification_last_attempt_at`
- `notification_error_summary`

The service must never roll back or block a created ticket because Slack or email failed.

## KB approval bin

Resolved tickets are operational records, not ingestable knowledge.

The curation path is:

1. Ticket is resolved.
2. Operator moves it to the KB approval bin.
3. A draft artifact is edited and reviewed.
4. The approved artifact is ingested into `kinetix_support_kb`.

No raw ticket thread is auto-ingested.

## Curated KB bulk import (optional)

For operator-reviewed **curated** articles (JSON array of ingest artifacts), use:

```bash
node scripts/kb-bulk-import.mjs --file ./curated-artifacts.json --dry-run
KINETIX_RAG_BASE_URL=http://localhost:3001 node scripts/kb-bulk-import.mjs --file ./curated-artifacts.json --ingest
```

Rules:

- Each array element must pass `validateSupportArtifactForIngest` (same as `POST /support/kb/ingest`).
- Duplicate `artifact_id` values in one file are rejected.
- This does **not** import tickets; it only ingests curated artifacts.
- Chroma and embeddings must be reachable for `--ingest` (same requirements as normal ingest).
