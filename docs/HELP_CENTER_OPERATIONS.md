# Kinetix Help Center Operations

This runbook covers the shipped Kinetix web Help Center support flow.

## Scope

- End-user support entry: `/help`
- Operator dashboard: `/operator`
- Operator queue: `/support-queue`
- Ticket store: `kinetix.support_tickets`
- Approval bin: `kinetix.support_kb_approval_bin`
- Curated support collection: `kinetix_support_kb`

## Required configuration

- `KINETIX_SUPPORT_OPERATOR_USER_IDS`
- `KINETIX_APP_BASE_URL`
- `KINETIX_RAG_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Slack notifications:

- `KINETIX_SUPPORT_SLACK_WEBHOOK_URL`

Email notifications:

- `KINETIX_SUPPORT_EMAIL_TO`
- `KINETIX_SUPPORT_EMAIL_FROM`
- `RESEND_API_KEY`

Optional SLA defaults (used when creating new tickets and when backfilling missing due timestamps):

- `KINETIX_SUPPORT_SLA_FIRST_RESPONSE_HOURS` (default `4`)
- `KINETIX_SUPPORT_SLA_RESOLUTION_HOURS` (default `72`)

Optional client-side feature flags:

- `VITE_ENABLE_OPERATOR_DASHBOARD` (default `true`)
- `VITE_ENABLE_SLA_METRICS` (default `true`)
- `VITE_ENABLE_ESCALATION` (default `true`)
- `VITE_ESCALATION_PROXY_URL` (required for operator escalation Slack path; client POST target, typically `/api/escalationNotify` on the app origin)

Phase-3B escalation channel:

- `ESCALATION_SLACK_WEBHOOK_URL` (server only; required when escalation Slack delivery is enabled; do not prefix with `VITE_`)

Phase-3C escalation hardening:

- server-side resend identity: `ticketId + escalationLevel + dayBucket`
- resend window: 24 hours
- rate-limit safety: 50 Slack sends per minute per process
- dedupe scope: process-local only; not durable across deploys, restarts, or multiple instances (no DB-backed notification log in this phase)
- operator-facing Slack text includes environment, ticket link, timestamp, assignee, and triage labels where available

## Runtime behavior

1. `/help` queries the curated support KB, then calls `/api/ai-chat` with grounded excerpts for the primary reply.
2. KB excerpts are shown as Sources; if retrieval is weak, empty, or unavailable, deterministic fallback appears (and may complement a failed AI call).
3. The UI proposes escalation only after the hybrid gate (two unresolved completed searches or two **Still not resolved** clicks in the session).
4. A ticket is created only after the user confirms.
5. Ticket persistence is authoritative.
6. Slack and email notification delivery runs after the ticket is stored.
7. Notification failure never deletes or blocks the ticket.

## Frozen live contract

Rollout must preserve the behavior locked in `apps/web/HELP_CENTER_ARCHITECTURE.md`.

### `/help`

- Retrieval is against `kinetix_support_kb`, not `kinetix_runs`.
- The primary support reply is AI-generated via `/api/ai-chat`, grounded on retrieved excerpts; Sources list the curated hits.
- Deterministic fallback appears when retrieval is weak, empty, or unavailable.
- No direct self-serve ticket button exists.
- Escalation requires the hybrid two-attempt gate and explicit user confirmation.
- Tickets and mailto payloads include support-AI ok flag, optional answer hash, and session counters (`help_still_not_resolved_clicks`, `help_unresolved_completed_search_count`).

### `/support-queue`

- Only allowlisted operators may use the queue routes.
- Queue links from notifications target `/support-queue?ticketId=<id>` and must open the referenced ticket when present.
- Operators can update ticket status and internal notes, retry notifications, and move resolved tickets into the KB approval bin.
- Operators can assign/unassign/reassign tickets (`assigned_to` / `assigned_at` on `kinetix.support_tickets`). Assignment uses Supabase auth user ids (same identifier shape as `KINETIX_SUPPORT_OPERATOR_USER_IDS`).
- SLA-facing fields (`first_response_due_at`, `resolution_due_at`, `last_operator_action_at`) are stored on the ticket row. The API adds a derived `labels` array for compact triage (for example `overdue_first_response`, `awaiting_retry`, `ready_for_kb`). These labels do not replace persisted `status`.
- The API also adds a separate derived `escalation_level` field: `0` for normal, `1` for tickets overdue by more than 4 hours, and `2` for tickets overdue by more than 24 hours.
- `GET /api/support-queue/tickets` returns `summary` counts (unassigned, overdue, awaiting retry, ready for KB, assigned to the current operator, recently updated, stale resolved-not-ingested, escalated, critical escalated) plus additive `slaMetrics` for the same list window.

### `/operator`

- `/operator` is an additive operator landing page. It does not replace or alter `/support-queue`.
- The page reuses `GET /api/support-queue/tickets` and surfaces:
  - compact operator summary cards (`Open tickets`, `Urgent tickets`, `Escalated tickets`, `Assigned to me`)
  - lightweight SLA health and aggregate warning/breach counts
  - a top-5 escalation list
  - deep links back into `/support-queue`
- Dashboard quick links use query-param filters: `/support-queue`, `/support-queue?urgent=1`, `/support-queue?assigned=me`, `/support-queue?escalated=1`.
- Escalation list ordering is deterministic:
  1. highest `escalation_level`
  2. oldest `created_at`
  3. `ticket_id` ascending
- SLA authority remains server-derived. The dashboard only maps existing API-derived labels and escalation levels into `healthy`, `warning`, and `breached` presentation states.
- Escalation notification is enabled through a lightweight proxy path when `VITE_ENABLE_ESCALATION=true`, `VITE_ESCALATION_PROXY_URL` is configured, and the server has `ESCALATION_SLACK_WEBHOOK_URL`.
- Notification delivery is best-effort and non-blocking. The UI must never fail because Slack delivery failed.
- The server route is the Slack dedupe authority. Duplicate, rate-limited, disabled, or unconfigured cases resolve as silent `204` no-op outcomes.

## Phase-3 Operator Operations

- Phase 3 is additive only. It does not replace the queue contract, persisted SLA fields, or server-derived escalation semantics.
- The support queue now accepts lightweight operator filters from query params:
  - `urgent=1` for overdue or escalated tickets
  - `assigned=me` for tickets assigned to the signed-in operator
  - `escalated=1` for `escalation_level > 0`
- Queue and dashboard surfaces show `SLA Warning` and `SLA Breach` badges derived from existing authoritative ticket labels and escalation levels.
- Feature flags degrade gracefully:
  - if a flag is disabled, the related UI block is hidden or replaced with a non-crashing disabled state
  - if queue data fails to load, summary counts and escalation lists stay empty rather than crashing
- `notifyEscalation(ticket)` dedupes by `ticket_id`, logs locally for operator visibility, and best-effort POSTs to the configured escalation proxy.
- Real Slack delivery is routed through `POST /api/escalationNotify`, which forwards only minimal escalation metadata to `ESCALATION_SLACK_WEBHOOK_URL`.
- Client dedupe reduces per-session chatter. Server dedupe suppresses repeated Slack sends per process within the current resend bucket.

### Implementation references (web)

- `apps/web/src/lib/featureFlags.ts` -- `VITE_ENABLE_OPERATOR_DASHBOARD`, `VITE_ENABLE_SLA_METRICS`, `VITE_ENABLE_ESCALATION` (default on; graceful hide when off).
- `apps/web/src/lib/helpcenter/sla.ts` -- maps authoritative API labels and `escalation_level` to SLA presentation (`healthy` / `warning` / `breached`).
- `apps/web/src/lib/helpcenter/escalation.ts` -- deterministic escalation sort (`escalation_level` desc, `created_at` asc, `ticket_id` asc), client-session dedupe, `checkEscalations`.
- `apps/web/src/lib/helpcenter/notify.ts` -- best-effort client POST to `VITE_ESCALATION_PROXY_URL`.
- `api/escalationNotify.ts` -- hardened server proxy to `ESCALATION_SLACK_WEBHOOK_URL` with process-local resend suppression and rate-limit safety.
- `apps/web/src/pages/OperatorDashboard.tsx` and `apps/web/src/pages/SupportQueue.tsx` -- operator surfaces and queue filters.
- `apps/web/src/lib/supportTicketDerived.ts` -- triage filters including `urgent` and `escalated`, aligned with query params below.

### KB approval

- Only `resolved` tickets may move into the approval bin.
- Drafts must stay inside the allowed taxonomy for topic, intent, and review status.
- No raw ticket may be auto-ingested.

### Notifications

- Ticket creation inserts first, then fan-out runs.
- Channel failures update notification status fields on the existing ticket.
- Retries operate on the existing ticket record.
- Operator escalation notifications are separate from ticket-create notifications. They are best-effort, deduped per browser session on the client, deduped per process on the server, Slack-first, and reversible by removing `VITE_ESCALATION_PROXY_URL` or `ESCALATION_SLACK_WEBHOOK_URL`.

## Operator queue workflow

1. Open `/support-queue` while signed in as an allowlisted operator.
2. Open the deep-linked ticket when coming from Slack or email; otherwise review the newest ticket.
3. Update `status` as it moves through `open`, `triaged`, `in_progress`, `resolved`, or `closed`.
4. Keep operator-only context in `internal notes`.
5. Check `notification_slack_status`, `notification_email_status`, and `notification_error_summary`.
6. Use `Retry notifications` when the ticket exists but one or more channels failed.

## KB approval workflow

1. Resolve the ticket first.
2. In the queue, use `Move to KB approval bin`.
3. Open the draft in the KB approval panel.
4. Rewrite the content into reusable support guidance.
5. Remove ticket-specific or user-specific details.
6. Edit optional **excerpt** (short summary) plus **body markdown**; preview in the operator UI is plaintext (not a full markdown renderer).
7. Save the draft with a valid topic, intent, and review status.
8. Use `Approve and ingest` only when the artifact is ready for the curated KB.

## Curated bulk import (optional)

For operator-reviewed curated articles (not tickets), see `apps/rag/scripts/kb-bulk-import.mjs` and `apps/rag/README.md`. This validates the same artifact shape as `POST /support/kb/ingest` and can optionally POST each artifact to a running RAG base URL. It does not bypass the ticket-first workflow for escalations.

## Content rules

- Never auto-ingest a raw ticket.
- Never ingest user-specific metrics, secrets, tokens, or private logs.
- Keep support KB content general, reviewed, and product-reusable.
- Support KB and run-analysis embeddings remain separate.

## Failure handling

Ticket create fails:

- The app does not create a ticket.
- If `VITE_SUPPORT_EMAIL` is configured, the client can fall back to `mailto`.

Ticket create succeeds but notifications fail:

- The ticket remains valid.
- Retry notifications from `/support-queue`.
- Use `notification_error_summary` to identify the failed channel.

KB ingest fails:

- The draft stays in the approval bin.
- Fix the draft or the RAG service configuration, then retry approval and ingest.

## Verification (release candidate)

**Phase-3C Help Center operator surfaces:** implemented additively on top of the existing queue contract and verified at **release-candidate** level for merge. **Merge confidence:** high. **Production confidence:** good, with one operational precondition: before production rollout, run **one real backend operator pass** with `pnpm dev`, sign in as an allowlisted operator, and manually walk `/operator` and `/support-queue` against live API and DB.

Automated checks (from `apps/web`):

- `pnpm lint`: passed
- `pnpm type-check`: passed
- `pnpm test:e2e:operator`: passed
- `pnpm test:vitest:serial`: passed
- Full Vitest suite: `pnpm exec vitest run --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1` (or `pnpm test:vitest:serial` in `package.json`) passed

**Notes**

- On some environments, raw `pnpm vitest run` can hit local worker or sandbox spawn instability; the **single-fork** invocation above is the recorded stable path for a full suite run.
- The Playwright operator smoke uses mocked support-queue and KB endpoints plus `VITE_SKIP_AUTH=1`.
- It verifies routing, rendering, query-param filters, SLA badges, escalation ordering, escalation UI, and KB bin visibility.
- It does not validate live API or DB behavior.
- A manual smoke against `pnpm dev` and the real backend remains required before production.
