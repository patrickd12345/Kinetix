# Kinetix Web Help Center

This document tracks the shipped Kinetix web Help Center against the Bookiji shared Help Center standard.

Architecture details live in [HELP_CENTER_ARCHITECTURE.md](./HELP_CENTER_ARCHITECTURE.md).
Operator steps live in [HELP_CENTER_OPERATIONS.md](../../docs/HELP_CENTER_OPERATIONS.md).

## Current state

| Standard expectation | Kinetix web status |
| --- | --- |
| Stable Help / Support entry point | Done. `Help` is in the main nav and routes to `/help`. |
| AI-first when tier allows | Done for `/help` support search: KB retrieval then `POST /api/ai-chat` with grounded excerpts; Coach chat remains the run-specific AI path. |
| Grounded curated support RAG | Done. `/help` queries `kinetix_support_kb` through `src/lib/supportRagClient.ts`; support KB and run embeddings stay separate. |
| Deterministic fallback when retrieval is empty, weak, or unavailable | Done. `src/lib/helpCenterFallback.ts` drives the fallback panel alongside AI and sources. |
| AI-controlled escalation with explicit confirmation | Done. No direct open-ticket button; escalation is proposed only after the hybrid two-attempt gate, then explicit confirmation. |
| Ticket-authoritative persistence | Done. `POST /support/ticket/create` persists the ticket first. Slack and email notification failures do not roll back or block the ticket. |
| Operator queue inside `apps/web` | Done. `/support-queue` provides ticket list, detail, notes, status updates, notification retry, and KB-bin actions through protected API routes. |
| Curated reinjection of resolved tickets into support KB | Done for v1. Resolved tickets move to a KB approval bin, become editable drafts, and are manually approved before ingest. |
| Human support not default first line | Done. `/help` runs KB retrieval, AI answer, sources, deterministic fallback when needed, hybrid-gated escalation proposal, then explicit confirmation. |

## Shipped flow

1. User asks in `/help`.
2. Curated KB retrieval runs against `kinetix_support_kb`.
3. The support assistant calls `/api/ai-chat` with serialized excerpts; the AI reply is shown first, then Sources (KB excerpts).
4. Deterministic fallback appears when retrieval is weak, empty, or unavailable (and on AI failure, excerpts and tips still apply).
5. **Still not resolved** is always available after a completed search; escalation is proposed only after two unsuccessful attempts (two unresolved completed searches or two still-not-resolved clicks).
6. The user confirms.
7. `POST /support/ticket/create` persists the ticket in Supabase.
8. Slack and email notifications run after persistence and update per-channel status fields.
9. Operators work the queue in `/support-queue`.
10. Resolved tickets can move to the KB approval bin.
11. Approved drafts are manually ingested into `kinetix_support_kb`.

## Frozen behavior contract

The live rollout must preserve these contracts from [HELP_CENTER_ARCHITECTURE.md](./HELP_CENTER_ARCHITECTURE.md):

- `/help`: AI-grounded support answer first (KB + `/api/ai-chat`), sources second, deterministic fallback when applicable, hybrid-gated escalation, and escalation only after explicit user confirmation.
- `/support-queue`: operator-only queue backed by persisted ticket state, with deep links to `?ticketId=` resolving to the intended ticket.
- KB approval: only resolved tickets enter the approval bin, drafts stay curated and validated, and nothing raw is auto-ingested.
- Notifications: ticket persistence is authoritative; Slack/email fan-out happens after insert and failures only update status fields.

## Configuration

- Client: `VITE_RAG_SERVICE_URL`
- Optional override for support AI endpoint URL: `VITE_HELP_CENTER_AI_URL` (defaults to same-origin `/api/ai-chat`)
- Client fallback only: `VITE_SUPPORT_EMAIL`
- Optional client version stamp: `VITE_APP_VERSION`
- Operator allowlist: `KINETIX_SUPPORT_OPERATOR_USER_IDS`
- Slack notifications: `KINETIX_SUPPORT_SLACK_WEBHOOK_URL`
- Email notifications: `KINETIX_SUPPORT_EMAIL_TO`, `KINETIX_SUPPORT_EMAIL_FROM`, `RESEND_API_KEY`
- Queue links and ingest calls: `KINETIX_APP_BASE_URL`, `KINETIX_RAG_BASE_URL`

## Deferred

- Automated assignment, SLA tracking, and analytics for operators.
- Automated bulk ingest CI for support corpus artifacts.
- Richer CMS-style authoring for fallback content and KB drafts.
