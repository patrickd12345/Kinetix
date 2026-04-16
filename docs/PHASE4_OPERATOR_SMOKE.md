# Phase 4 — Operator smoke checklist

**Last updated:** 2026-04-10  
**Canonical runbook:** [`HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md)  
**Guardrail:** Wave 2 web **closed**; smoke tests are **manual** release gates — they do not expand Wave 2 scope.

Use a **staging or production-like** environment with real Supabase, operator allowlist, and notification secrets configured (or accept documented no-ops for Slack/email).

## 1. Help Center (`/help`)

- [ ] Curated KB loads (or deterministic empty state) — retrieval from `kinetix_support_kb` per runbook.
- [ ] Primary reply path: `/api/ai-chat` returns **200** or documented fallback when AI unavailable.
- [ ] **Sources** list appears when excerpts exist.
- [ ] Escalation: hybrid gate (two unresolved searches or two **Still not resolved**) before ticket offer.
- [ ] Ticket creation only after **explicit user confirmation**; ticket row visible in DB / queue after success.

## 2. Support queue (`/support-queue`)

- [ ] Non-operator receives **403** on API (`GET /api/support-queue/tickets`).
- [ ] Operator allowlisted via `KINETIX_SUPPORT_OPERATOR_USER_IDS` can list tickets; **summary** + **slaMetrics** present on list response.
- [ ] Deep link `?ticketId=` opens the correct ticket.
- [ ] PATCH status / internal notes / assignment — persisted and reflected on refresh.
- [ ] **Move to KB approval bin** only for **resolved** tickets (validation error otherwise).

## 3. Operator dashboard (`/operator`)

- [ ] Loads summary cards and top escalation list when flags enabled (`VITE_ENABLE_OPERATOR_DASHBOARD`, etc.).
- [ ] Links to `/support-queue` with filters (`urgent`, `assigned=me`, `escalated`) work.

## 4. KB staging / approval

- [ ] `GET /api/support-queue/kb-approval` lists drafts (operator).
- [ ] `PATCH` draft updates persist; `POST .../approve-ingest` runs ingest path (or documented 503 if RAG/backend down).

## 5. Escalation proxy (optional)

- [ ] With `VITE_ENABLE_ESCALATION=true` and `VITE_ESCALATION_PROXY_URL` + server `ESCALATION_SLACK_WEBHOOK_URL`, escalation posts reach Slack or **204** no-op per documented semantics — UI must not crash on failure.

## Evidence

Record environment (preview/production), date, operator user id used, and pass/fail per section in release notes or internal ticket.

## References

- [`PHASE4_DEPLOYMENT_CHECKLIST.md`](PHASE4_DEPLOYMENT_CHECKLIST.md)
- [`PHASE4_E2E_PLAN.md`](PHASE4_E2E_PLAN.md)
