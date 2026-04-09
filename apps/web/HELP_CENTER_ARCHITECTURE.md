# Kinetix Help Center — shipped architecture contract

**Scope:** Kinetix web Help Center and operator support flow.  
**Status:** shipped for v1. This file is the frozen behavior contract that rollout must preserve.

Related docs:
- [HELP_CENTER.md](./HELP_CENTER.md)
- [../../docs/HELP_CENTER_OPERATIONS.md](../../docs/HELP_CENTER_OPERATIONS.md)
- [../rag/README.md](../rag/README.md)

---

## Contract summary

The Kinetix Help Center has four live contracts:

1. `/help` contract
2. `/support-queue` contract
3. KB approval contract
4. Notification contract

Any rollout, migration, or env change must preserve those semantics.

---

## `/help` contract

`/help` is a self-service-first support surface.

### Required behavior

1. Coach chat remains the dedicated AI path for run-specific questions (run-coach RAG).
2. Curated support retrieval uses `kinetix_support_kb`, not `kinetix_runs`.
3. Support search on `/help` is **AI-first**: after each query, the client retrieves KB excerpts, then calls `POST /api/ai-chat` with a fixed support system prompt and serialized excerpts. The **primary** user-facing reply is the model output; curated hits are shown as **Sources** below.
4. If the LLM call fails, the UI still shows KB excerpts (when present) and deterministic fallback when retrieval is weak, empty, or unavailable.
5. **Hybrid escalation gate:** escalation is proposed only when **either** (a) the user has clicked **Still not resolved** twice in the session, **or** (b) **two** completed support searches each ended **unresolved** (retrieval unresolved per `isUnresolvedRetrievalOutcome`, or AI failed/empty answer). Session counters reset on full page reload only (not on each new query text).
6. No ticket is created until the user explicitly confirms the escalation prompt.
7. After two escalation prompts have been **counted** (first ever prompt plus one per subsequent prompt following **No, keep troubleshooting**), further eligible searches show a capped state instead of another prompt. Extra unresolved searches without dismissing the dialog do not advance the cap by themselves.
8. If ticket creation fails and `VITE_SUPPORT_EMAIL` is configured, the client may fall back to `mailto`.
9. Ticket and mailto payloads include support-AI outcome summary, optional answer hash, and the two session counters for triage.

### Forbidden behavior

- No direct self-serve "open ticket" button on `/help`.
- No support knowledge mixed into run embeddings.
- No escalation proposal on the first unresolved attempt alone (must satisfy the hybrid gate).
- No ticket creation before explicit user confirmation.

### Live implementation

- Web page: `apps/web/src/pages/HelpCenter.tsx`
- Retrieval client: `apps/web/src/lib/supportRagClient.ts`
- Support AI client: `apps/web/src/lib/helpCenterSupportAi.ts` (same `/api/ai-chat` contract as Vercel `api/ai-chat` and local `vite-plugin-oauth`)
- Deterministic fallback: `apps/web/src/lib/helpCenterFallback.ts`
- Escalation payload shaping: `apps/web/src/lib/helpCenterEscalation.ts`

---

## `/support-queue` contract

`/support-queue` is the operator-only queue for persisted support tickets.

### Required behavior

1. Queue APIs require an authenticated user whose id is allowlisted by `KINETIX_SUPPORT_OPERATOR_USER_IDS`.
2. The queue shows persisted ticket state from `kinetix.support_tickets`; it is not an in-memory inbox.
3. Notification status fields remain visible even when delivery failed.
4. Deep links to `/support-queue?ticketId=<id>` must open the referenced ticket when it exists.
5. Operators can update `status` and `internal_notes`.
6. Operators can retry notifications without recreating the ticket.
7. Operators can move a ticket to the KB approval bin only after the ticket is `resolved`.

### Allowed ticket statuses

- `open`
- `triaged`
- `in_progress`
- `resolved`
- `closed`

### Live implementation

- Page: `apps/web/src/pages/SupportQueue.tsx`
- Client: `apps/web/src/lib/supportQueueClient.ts`
- Operator auth: `api/_lib/supportOperator.ts`
- Queue store: `api/_lib/supportQueueStore.ts`
- Queue routes (Vercel): single handler [`api/support-queue/tickets/[[...segments]].ts`](../../api/support-queue/tickets/[[...segments]].ts) — dispatches the same public paths as before: `GET /api/support-queue/tickets`, `GET|PATCH /api/support-queue/tickets/:ticketId`, `POST /api/support-queue/tickets/:ticketId/move-to-kb-bin`, `POST /api/support-queue/tickets/:ticketId/retry-notifications`.

---

## KB approval contract

Resolved tickets are operational records, not ingestable knowledge.

### Required behavior

1. A KB draft starts from a resolved ticket.
2. The draft must be edited before ingest; no raw ticket thread is auto-ingested.
3. Draft fields are validated before persistence, not left to database constraint failures.
4. Topic, intent, and review status stay inside the approved taxonomy.
5. `Approve and ingest` posts an approved artifact into `kinetix_support_kb`.
6. A successful ingest updates both the draft record and the source ticket KB state.

### Allowed draft taxonomy

- Topic: `account`, `billing`, `sync`, `import`, `kps`, `charts`, `privacy`, `general`
- Intent: `howto`, `troubleshoot`, `policy`, `limitation`
- Review status: `draft`, `approved`, `ingested`, `rejected`

### Forbidden behavior

- No automatic ingest of a newly created ticket.
- No user-specific, secret, or private-log content in the curated KB.
- No approval-bin move from a ticket that is not yet `resolved`.

### Live implementation

- Approval table: `kinetix.support_kb_approval_bin`
- Page: `apps/web/src/pages/SupportQueue.tsx`
- Store: `api/_lib/supportQueueStore.ts`
- Routes: `api/support-queue/kb-approval/*`
- Ingest endpoint: `POST /support/kb/ingest`

---

## Notification contract

Ticket persistence is authoritative. Notifications are best-effort fan-out after the write succeeds.

### Required behavior

1. `POST /support/ticket/create` validates the payload and inserts the ticket first.
2. Slack and email notification delivery happen only after insert succeeds.
3. Notification failure never rolls back, deletes, or blocks the created ticket.
4. Per-channel delivery state is written back to the ticket row.
5. Notification retry works from `/support-queue` against the existing ticket.
6. Queue links in Slack/email point back to `/support-queue?ticketId=<id>`.

### Channel status values

- `pending`
- `sent`
- `failed`
- `unconfigured`

### Live implementation

- Ticket create: `apps/rag/services/supportTicketCreate.js`
- RAG fan-out: `apps/rag/services/supportNotifications.js`
- Queue retry fan-out: `api/_lib/supportNotifications.ts`
- Ticket columns: `notification_slack_status`, `notification_email_status`, `notification_last_attempt_at`, `notification_error_summary`

---

## Data separation contract

Run analysis and support knowledge stay separate.

| Surface | Collection / store | Purpose |
| --- | --- | --- |
| Run coaching | `kinetix_runs` | Run similarity, coach context, run analysis |
| Help Center support | `kinetix_support_kb` | Curated support retrieval only |
| Support operations | `kinetix.support_tickets` | Escalation records |
| KB curation staging | `kinetix.support_kb_approval_bin` | Operator-reviewed drafts before ingest |

Support content must never be inserted into `kinetix_runs`, and raw tickets must never be auto-ingested into `kinetix_support_kb`.

---

## Withings API (Vercel)

OAuth code exchange and token refresh share one serverless handler for Hobby plan function-count limits:

- Handler: [`api/withings/index.ts`](../../api/withings/index.ts) (`POST /api/withings` — branch on `code` vs `refresh_token`).
- Production [`vercel.json`](../../vercel.json) **rewrites** preserve legacy paths: `/api/withings-oauth` and `/api/withings-refresh` both route to `/api/withings`. Web clients and local dev middleware continue to call the legacy URLs.

---

## Rollout prerequisites

Before end-to-end activation:

1. Apply `supabase/migrations/20260408000000_support_queue_notifications_and_kb_bin.sql`.
2. Apply `supabase/migrations/20260408140000_kinetix_support_queue_operator_sla.sql` (operator assignment + SLA columns + KB draft excerpt).
3. Configure:
   - `KINETIX_SUPPORT_OPERATOR_USER_IDS`
   - `KINETIX_APP_BASE_URL`
   - `KINETIX_RAG_BASE_URL`
   - `KINETIX_SUPPORT_SLACK_WEBHOOK_URL`
   - `KINETIX_SUPPORT_EMAIL_TO`
   - `KINETIX_SUPPORT_EMAIL_FROM`
   - `RESEND_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Ensure curated support content exists in `kinetix_support_kb`.

---

## Deferred beyond v1

Shipped as incremental hardening (does not change the frozen contracts above):

- Operator assignment + SLA timestamps + derived triage labels + compact queue summary (`GET /api/support-queue/tickets` includes `summary`)
- KB draft **excerpt** field + operator preview (plaintext) before ingest
- Optional curated bulk import helper for **non-ticket** artifacts (`apps/rag/scripts/kb-bulk-import.mjs`)

Still deferred / not promised here:

- Full BI/reporting beyond compact triage counts
- A rich markdown preview renderer in the operator UI
- Any merge of coach chat and Help Center support modes
