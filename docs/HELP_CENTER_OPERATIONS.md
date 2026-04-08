# Kinetix Help Center Operations

This runbook covers the shipped Kinetix web Help Center support flow.

## Scope

- End-user support entry: `/help`
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

### KB approval

- Only `resolved` tickets may move into the approval bin.
- Drafts must stay inside the allowed taxonomy for topic, intent, and review status.
- No raw ticket may be auto-ingested.

### Notifications

- Ticket creation inserts first, then fan-out runs.
- Channel failures update notification status fields on the existing ticket.
- Retries operate on the existing ticket record.

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
6. Save the draft with a valid topic, intent, and review status.
7. Use `Approve and ingest` only when the artifact is ready for the curated KB.

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
