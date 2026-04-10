# Kinetix — Project Plan

**Source of truth:** This file is reconstructed from the Kinetix repo, `docs/deployment/*`, feature lists, and recent `git` history. Umbrella-only standards are referenced by path where they live outside this clone.

**Last reviewed:** 2026-04-10 (Wave 2 web **CLOSED**; controlled Phase 3-5 **doc** execution. Evidence: Vitest **346**, lint, type-check, **`pnpm run verify:vercel-parity` PASS** 2026-04-10; Phase 4 **manual production gate** log in [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) (admlog + Infisical prod **PASS**; support-queue API path returns SPA shell for anonymous `GET` — **blocker** until deploy/routing verified). Audits: [`PHASE3_ERROR_CONTRACT_ROLLOUT.md`](PHASE3_ERROR_CONTRACT_ROLLOUT.md), [`PHASE3_OBSERVABILITY_AUDIT.md`](PHASE3_OBSERVABILITY_AUDIT.md), [`PHASE3_CI_AUDIT.md`](PHASE3_CI_AUDIT.md), [`PHASE3_ENV_AUDIT.md`](PHASE3_ENV_AUDIT.md). Release planning: [`PHASE4_ENV_PARITY.md`](PHASE4_ENV_PARITY.md), [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md), [`PHASE4_DEPLOYMENT_CHECKLIST.md`](PHASE4_DEPLOYMENT_CHECKLIST.md), [`PHASE4_E2E_PLAN.md`](PHASE4_E2E_PLAN.md). Post-launch backlog: [`PHASE5_BACKLOG.md`](PHASE5_BACKLOG.md).)

**Current phase:** Phase 3 (Platform Hardening) — audit-first; not a Wave 2 scope reopen  
**Wave 2 (web):** Closed  
**Next focus:** Execute Phase 3 audit follow-ups as prioritized + Phase 4 release readiness gates (no Wave 2 feature expansion)

---

## Stabilization phases (post-Wave 2)

These phases are **documentation and operational** tracks after Wave 2 web closure. They do **not** reopen Wave 2 UI scope. The **Feature Roadmap** sections below (Phase 1-4) remain the historical product phasing; use this table for **current** engineering focus.

| Phase | Theme | Canonical docs |
|-------|--------|------------------|
| **Phase 3** | Platform hardening (error contract, observability, CI, env uniformity) | [`PHASE3_ERROR_CONTRACT_ROLLOUT.md`](PHASE3_ERROR_CONTRACT_ROLLOUT.md), [`PHASE3_OBSERVABILITY_AUDIT.md`](PHASE3_OBSERVABILITY_AUDIT.md), [`PHASE3_CI_AUDIT.md`](PHASE3_CI_AUDIT.md), [`PHASE3_ENV_AUDIT.md`](PHASE3_ENV_AUDIT.md) |
| **Phase 4** | Release readiness (env parity validation, operator smoke, deploy checklist, E2E plan) | [`PHASE4_ENV_PARITY.md`](PHASE4_ENV_PARITY.md), [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md), [`PHASE4_DEPLOYMENT_CHECKLIST.md`](PHASE4_DEPLOYMENT_CHECKLIST.md), [`PHASE4_E2E_PLAN.md`](PHASE4_E2E_PLAN.md) |
| **Phase 5** | Post-launch enhancements (classified backlog) | [`PHASE5_BACKLOG.md`](PHASE5_BACKLOG.md) |

Tracker: [`KINETIX_SCOPE_CLOSURE.md`](KINETIX_SCOPE_CLOSURE.md) (includes **Current phase** line).

---

## Vision

Kinetix is a **running-first personal performance** product: normalize effort via **KPS** (Kinetix Performance Score / NPI lineage), surface history and analytics in **web** and **native** clients, and add **LLM-assisted** coaching and retrieval (RAG) without turning the product into a social feed. It sits in the **Bookiji Inc** ecosystem: shared **Supabase** identity (`platform.profiles`), **entitlements** (`platform.entitlements`, `product_key = 'kinetix'`), and optional cross-app runtime packages (`@bookiji-inc/*`).

---

## Scope

**In scope (as implemented or actively maintained in this repo):**

- **Web (`apps/web`):** Vite + React SPA; GPS run recording; history, filters, charts; KPS per [`KPS_CONTRACT.md`](../KPS_CONTRACT.md) and [`packages/core`](../packages/core); Garmin ZIP / `.fit` import; Strava OAuth + import; Withings OAuth + weight history; AI coach paths (local Ollama and/or gateway); Help Center / support flows as wired to RAG and APIs.
- **RAG (`apps/rag`):** HTTP service — run indexing (`kinetix_runs`), help KB collection (`kinetix_support_kb`), LLM provider (`ollama` / `gateway`), Chroma embeddings. Support ticket endpoints write **`kinetix.support_tickets`** first, then fan out Slack/email notification status per [`apps/rag/README.md`](../apps/rag/README.md).
- **Serverless API (`api/`):** Vercel functions — billing checkout, Strava/Withings OAuth helpers, `ai-chat` / `ai-coach`, admlog (non-prod), shared `_lib` (Stripe, Supabase JWT user, AI/memory boundary). As of 2026-04-08 the **deployed** route file count under `api/` (excluding `_lib`) is **12**, within the Vercel Hobby cap. See `vercel.json` rewrites.
- **Shared core (`packages/core`):** KPS math, location/physio helpers consumed by web (and intended for parity with native).
- **Native:** `ios/KinetixPhone`, `watchos/KinetixWatch` — sensor-rich coaching and sync (see [`FEATURES_PHONE.md`](../FEATURES_PHONE.md), [`FEATURES_WATCH.md`](../FEATURES_WATCH.md)).

**Explicitly documented as web limitations:** No HealthKit, no Watch live stream to browser, simulated heart rate on web, no map visualization of routes yet — see [`FEATURES_WEB.md`](../FEATURES_WEB.md) § Missing / Limitations.

---

## Non Goals

- **Not a Strava-style social graph** in product positioning (anti-feed / anti-performative running remains the design intent per [`README.md`](../README.md)).
- **No second Stripe webhook** on Kinetix: canonical **`POST /api/payments/webhook`** lives on **Bookiji**; Kinetix only creates Checkout sessions — see [`docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).
- **RAG service** does not implement end-user auth; the web app enforces access (`apps/rag/README.md`).
- **Schema migrations for the shared Supabase project** are not asserted as owned inside this repo snapshot; platform and product tables are consumed per deployment docs (TODO: confirm single migration repo of record in umbrella if needed).

---

## Architecture

| Layer | Technology | Evidence |
| ----- | ---------- | -------- |
| Web client | **Vite**, React, TypeScript | `apps/web`, `vercel.json` `"framework": "vite"` |
| Hosting | **Vercel** | `vercel.json`, `outputDirectory`: `apps/web/dist` |
| Serverless API | **Vercel** Node handlers | `api/**/*.ts`, `vercel.json` `functions` |
| Edge | TODO: document if any routes explicitly use Edge runtime | — |
| Auth / data plane | **Supabase** (same project as Bookiji for SSO) | [`docs/deployment/ENV_PARITY.md`](deployment/ENV_PARITY.md) |
| RAG + vectors | **Express** app, **Chroma**, embeddings | `apps/rag` |
| AI packages | `@bookiji-inc/ai-runtime`, persistent memory runtime | `apps/web/package.json`, `api/_lib/ai/*` |
| Native | SwiftUI, Watch Connectivity, HealthKit, Core ML | [`ARCHITECTURE.md`](../ARCHITECTURE.md) |

**Correction vs external briefs:** The production web app is **not** Next.js; do not describe Kinetix web as Next.js in internal docs.

---

## Data Model

**Client-side (web):** Run history, settings, and optional song metadata (`songTitle`, `songArtist`, `songBpm`) — persisted locally (storage strategy summarized in [`FEATURES_WEB.md`](../FEATURES_WEB.md); IndexedDB/Dexie referenced there for scale).

**Supabase (shared spine, read/write as implemented):**

- **`platform.profiles`** — profile rows keyed to auth user id (`apps/web/src/lib/platformAuth.ts`, `api/_lib/platformAuth.ts`).
- **`platform.entitlements`** — `product_key = 'kinetix'` for subscription gating (`platformAuth.ts`, [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md)).
- **`kinetix.support_tickets`** — authoritative Help Center escalation records, operator notes, notification state, KB approval state, operator assignment (`assigned_to` / `assigned_at`), SLA due timestamps, and last operator action timestamp (`apps/rag/README.md`, `supabase/migrations/20260408140000_kinetix_support_queue_operator_sla.sql`).
- **`kinetix.support_kb_approval_bin`** — operator-reviewed drafts for reusable support knowledge before ingest, including optional **excerpt** (`apps/web/HELP_CENTER_ARCHITECTURE.md`).

**KPS:** Computed from run facts + profile; display uses **relative KPS** vs PB per [`KPS_CONTRACT.md`](../KPS_CONTRACT.md) — not authoritative stored display state.

**TODO:** Trace and document every `kinetix.*` table the web client or API writes to (e.g. activity mirror mentioned in feature copy) with exact client paths, if product scope requires a single ER diagram here.

---

## Feature Roadmap

Roadmap phases below map **themes** to **evidence in repo/docs**. They are not dated releases.

### Phase 1 — Core Analytics

**Largely shipped (web + core):** Run logging, pace/distance/time, KPS/NPI, history UI, filters, charts (`FEATURES_WEB.md`). Native apps: full biomechanics and presets (`FEATURES_WATCH.md`, `FEATURES_PHONE.md`).

**Gaps (web):** Map visualization, export/share, real HR (see `FEATURES_WEB.md` limitations).

### Phase 2 — Intelligence Layer

**Shipped / partial:** RAG service (`apps/rag`), AI coach + chat API routes (`api/ai-coach`, `api/ai-chat`), Ollama + gateway resolution (`apps/rag/README.md`, recent commits on provider resolution). **Persistent memory boundary:** `api/_lib/ai/kinetixMemoryBoundary.ts`, `@bookiji-inc/persistent-memory-runtime`, `umbrellaRuntimeBridge.ts` (session payload shaping / optional umbrella bridge). **Deterministic chat math guardrails:** `packages/core` `chatMath/*`, `api/_lib/ai/chatMathGate.ts` — server-verified pace/KPS math with fail-closed replies; see [`docs/architecture/LLM_MATH_GUARDRAILS.md`](architecture/LLM_MATH_GUARDRAILS.md).

**In progress / tighten:** Entitlement-aware UX, error surfaces, observability consistency (`PRODUCT_SCOPE.md` marks several platform standards **Partial**).

### Phase 3 — Integrations

**Web — implemented per `FEATURES_WEB.md`:** Strava import, Garmin import, Withings weights.

**Native / health:** Deep HealthKit and Watch streaming are **native**, not live-mirrored to web (see architecture Q&A in prior reviews; no WebSocket Watch→web in `apps/web`).

**TODO:** Apple Health export/import parity matrix if product requires explicit milestones (see [`FEATURES_COMPARISON.md`](../FEATURES_COMPARISON.md)).

### Phase 4 — Monetization

**Implemented (code + docs):** `POST /api/billing/create-checkout-session`, Stripe subscription metadata, Bookiji webhook updates `platform.entitlements` — [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).

**Also in repo:** Google **AdSense** integration in web app (commit `87d2055` on current `main` history).

**Operational:** Production env parity, checklist, Infisical paths — [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md), [`INFISICAL_LOCAL_DEV.md`](deployment/INFISICAL_LOCAL_DEV.md).

---

## Current Status

- **Help Center operator (phase 3C):** Treated as **release-candidate ready** in-repo: feature flags, SLA warning/breach presentation, query-param filters (`urgent`, `assigned`, `escalated`), deterministic escalation ordering, Slack-first escalation delivery, process-local server resend suppression, and rate-limit safety; automated verification under **Verification (release candidate)** in [`HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md). **Production gate:** one manual operator pass (`pnpm dev`, real backend, `/operator` and `/support-queue`) before rollout.
- **Production web:** `apps/web` → `kinetix.bookiji.com` per [`REPO_STATUS.md`](../REPO_STATUS.md) and `vercel.json`.
- **Billing:** Documented as wired; live enablement depends on env (`BILLING_ENABLED`, Stripe price id, Bookiji webhook).
- **CI / quality:** Root scripts `lint`, `type-check`, `test`; **`pnpm run verify:vercel-parity`** last **green** on **2026-04-10** (see [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md)); matches standalone clone + Vercel install path (see [`README.md`](../README.md)).
- **Recent commits (sample):** AdSense; repo structure / deployment clarity; web dashboard reset/idle; LLM provider resolution for Vercel; Withings redirect URI; theme selector; RAG support ticket endpoints; entitlement query fixes; Vercel ESM/API packaging fixes.

---

## Completed

- Canonical web migration to **`apps/web`** (legacy in `archive/web-legacy/`) — [`REPO_STATUS.md`](../REPO_STATUS.md), [`docs/WEB_APPS.md`](WEB_APPS.md).
- KPS contract and shared calculator in **`packages/core`** — [`KPS_CONTRACT.md`](../KPS_CONTRACT.md).
- Strava / Garmin / Withings flows on web — [`FEATURES_WEB.md`](../FEATURES_WEB.md).
- RAG collections split (runs vs support KB) — `apps/rag/README.md`.
- Stripe checkout + Bookiji single-webhook entitlements design — [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).
- Optional song BPM fields (web feature list + validation rules described in `FEATURES_WEB.md`).
- Help Center web support flow shipped: `/help` retrieval + deterministic fallback + explicit-confirmation escalation + authoritative ticket create.
- Operator queue shipped: `/support-queue` with status updates, internal notes, notification retry, deep-linked queue access, and resolved-only KB approval-bin moves.
- Help Center operator scale-up (phase 1): ticket assignment, SLA due fields + derived triage labels, compact queue summary on ticket list API, KB draft excerpts + plaintext preview, optional curated bulk-import CLI for non-ticket artifacts (`apps/rag/scripts/kb-bulk-import.mjs`).
- Help Center operator scale-up (phase 2): `/operator` landing page, additive queue `slaMetrics`, escalated and critical summary counts, and UI-only escalation indicators on queue/dashboard surfaces.
- Help Center operator scale-up (phase 3): feature-flagged operator surfaces (`featureFlags.ts`), SLA badge mapping (`helpcenter/sla.ts`), escalation sort + notify path (`helpcenter/escalation.ts`), extended queue URL filters and triage keys (`supportTicketDerived.ts`), query-param deep links on `/support-queue`.
- Help Center operator hardening (phase 3C): server-side Slack resend suppression via `ticketId + escalationLevel + dayBucket`, 24h resend window, process-local rate-limit safety, environment-aware Slack formatting, and documented no-op semantics for missing config / duplicates / delivery failure.
- Curated KB reinjection shipped for v1: approval drafts in `kinetix.support_kb_approval_bin` and manual ingest into `kinetix_support_kb`.
- Deterministic **LLM math guardrails** for chat (verified pace/KPS results, fail-closed on ambiguity) — [`docs/architecture/LLM_MATH_GUARDRAILS.md`](architecture/LLM_MATH_GUARDRAILS.md).
- Vercel **Hobby** serverless footprint reduced to **12** `api/**/*.ts` handlers (excluding `_lib`): smoke script moved out of `api/`, Withings oauth+refresh merged to `api/withings` with rewrites preserving client URLs, support-queue **tickets** subtree merged to `api/support-queue/tickets/[[...segments]].ts` with unchanged public ticket paths.
- **Wave 2 web closure (CLOSED):** [`docs/KINETIX_SCOPE_CLOSURE.md`](KINETIX_SCOPE_CLOSURE.md) records per-surface closure criteria, CLOSED status, feature freeze, and Phase 3-5 follow-through; [`docs/KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md) records full `@kinetix/web` Vitest run (**346** tests) plus lint/type-check; coaching context hooks consolidated to satisfy `react-hooks/rules-of-hooks` (merged `useKinetixCoachingContext` + `useKinetixCoachingContextState`).
- **Vercel parity gate (pre-ship):** `pnpm run verify:vercel-parity` **PASS** recorded **2026-04-10** in [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md) (Kinetix install + build + Bookiji Vercel-like build).

---

## In Progress

- **Phase 3 — Platform hardening (not blocking release):** Close **Partial** rows in [`PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) with measurable criteria — CI beyond web, env contract uniformity, observability consistency, feature-flag governance, error-contract adoption across `api/*` where not yet uniform. See [`KINETIX_SCOPE_CLOSURE.md`](KINETIX_SCOPE_CLOSURE.md) § Phase 3.
- **Phase 4 — Release readiness:** ENV parity ([`ENV_PARITY.md`](deployment/ENV_PARITY.md)), deployment checklist ([`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md)), Help Center operator smoke ([`HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md)), Playwright / release-candidate validation — execution log [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md).
- **Help Center ops** — phase-3C surfaces remain RC in-repo; production operator pass remains a Phase 4 gate.
- **Doc hygiene:** Keep `PRODUCT_SCOPE.md` and [`KINETIX_SCOPE_CLOSURE.md`](KINETIX_SCOPE_CLOSURE.md) aligned when billing or spine changes land.

---

## Next Priorities

1. **Phase 3:** Platform standard adoption toward **Full** where applicable — same dimensions as [`PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) (observability, env contract, feature flags, error contract); baseline evidence for Wave 2 remains in [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md).
2. **Phase 4:** Production release path — checklist, env parity, operator smoke; parity gate does not replace these.
3. **Phase 5 (post launch):** Web **map** and **export** (GPX/TCX) when prioritized ([`FEATURES_WEB.md`](../FEATURES_WEB.md)); production-tier **billing UX**; **AI reliability** in real gateway envs.
4. **Regression:** Re-run **`pnpm run verify:vercel-parity`** after changes to `scripts/vercel-install.sh`, workspace packages, or `@bookiji-inc/*` consumption (last green **2026-04-10**).

---

## Technical Debt

- **Scope doc vs code:** `PRODUCT_SCOPE.md` Stripe row was reconciled with checkout + Bookiji webhook docs (2026-04-04); re-check after major billing changes.
- **Web feature list freshness:** `FEATURES_WEB.md` last updated **2026-04-08** — re-audit against `apps/web` after large UI/auth changes.
- **Simulated HR on web** — blocks serious physio parity until Web Bluetooth or manual inputs expand.
- **No in-repo Supabase migration inventory** for `platform.*` / `kinetix.*` — risk of unclear ownership when schema changes (TODO: pointer to umbrella migration repo).

---

## Risks

- **Coupling to Bookiji:** Webhook downtime or schema drift on Bookiji side affects **entitlement** truth for Kinetix users.
- **Shared Supabase:** Auth redirect URL and RLS assumptions must stay aligned ([`ENV_PARITY.md`](deployment/ENV_PARITY.md)).
- **Standalone clone builds:** Production-like install uses `scripts/vercel-install.sh` + Bookiji-inc package clone; umbrella-only `../../packages` dev may hide breakage ([`README.md`](../README.md) parity section).
- **RAG + Chroma:** Operational complexity (local Docker/Python fallbacks); embedding and chunking quality directly affect coach usefulness.

---

## Dependencies

| Dependency | Role |
| ---------- | ---- |
| Bookiji app / Supabase project | SSO, `platform.profiles`, webhook handler for Stripe |
| `@bookiji-inc/*` packages | AI runtime, Stripe helpers, platform-auth, observability, error contract, persistent memory |
| Stripe | Subscription checkout (Kinetix API) + events → Bookiji webhook |
| Vercel | Host SPA + `api/*` serverless |
| Infisical (ops) | Secret merge `/platform` + `/kinetix` ([`INFISICAL_LOCAL_DEV.md`](deployment/INFISICAL_LOCAL_DEV.md)) |
| Optional: Ollama / AI gateway | LLM inference for coach and RAG |

---

## Bookiji Inc Integration

- **Identity:** Same Supabase project; magic link primary; optional OAuth via `VITE_AUTH_*_ENABLED` — [`ENV_PARITY.md`](deployment/ENV_PARITY.md).
- **Entitlements:** `platform.entitlements` with `product_key = 'kinetix'` — [`docs/deployment/README.md`](deployment/README.md).
- **Payments:** Single webhook rule on Bookiji — [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md) (idempotent event handling documented there and in Bookiji handler references).
- **Standards:** [`APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md) and [`SPINE_CONTRACT.md`](../../../../SPINE_CONTRACT.md) at umbrella root when this repo is checked out under `Bookiji inc/products/Kinetix`.
- **Optional memory bridge (governance, default off):** [`MEMORY_BRIDGE_CONTRACT.md`](../../../../docs/platform/MEMORY_BRIDGE_CONTRACT.md) — see deployment index; runtime touchpoints include `api/_lib/ai/umbrellaRuntimeBridge.ts` and persistent-memory runtime usage.

**Engineering rules (from org practice, enforced in docs/code):** No ad-hoc production DB edits; **migrations only** for schema; deterministic KPS logic per contract; webhook idempotency on Bookiji side for Stripe events.

---

## AI Strategy

- **Web:** Rule-based fallback when LLM unavailable; Ollama local dev; Vercel-oriented **gateway** path for hosted inference (see `apps/rag` env vars and recent `feat(llm)` commits).
- **RAG:** Separate collections for **runs** vs **support KB**; no automatic ticket ingestion into curated KB (`apps/rag/README.md`).
- **Memory:** Session boundary payload via `buildKinetixBoundaryFromChat` (`api/_lib/ai/kinetixMemoryBoundary.ts`) and `@bookiji-inc/persistent-memory-runtime`.
- **Native (iPhone):** Gemini for coaching — [`ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## Billing Strategy

- **Model:** Subscription Checkout created by Kinetix API; **Bookiji** webhook writes **`platform.entitlements`**; web reads entitlements via Supabase client — no Stripe secrets in browser bundle — [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).
- **TODO:** Document exact UI surfaces that gate premium features (file-level pointers in `apps/web`).

---

## Deployment Strategy

- **Build:** `pnpm --filter @kinetix/core build` then `pnpm --filter @kinetix/web build`; Vercel `installCommand` runs `scripts/vercel-install.sh` — `vercel.json`.
- **Domain / DNS:** [`KINETIX_SUBDOMAIN.md`](deployment/KINETIX_SUBDOMAIN.md).
- **Verification:** [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md), `pnpm verify:infisical`, `pnpm run verify:vercel-parity`.

---

## Long Term Vision

- Deeper **biomechanics** on web where sensors allow, or keep web as **analytics + import hub** while Watch/iPhone own raw form streams ([`FEATURES_COMPARISON.md`](../FEATURES_COMPARISON.md)).
- **Training plans** and optional social/export features — see [`README.md`](../README.md) Future Enhancements and native feature docs.
- Tighter **platform** scores (observability, error contract, feature flags) to **Full** in `PRODUCT_SCOPE.md`.

---

## Related index

| Doc | Purpose |
| --- | ------- |
| [`../README.md`](../README.md) | Product overview, commands, spine compliance |
| [`../REPO_STATUS.md`](../REPO_STATUS.md) | Canonical directories |
| [`../PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) | Audit scope (Stripe row aligned with deployment docs) |
| [`deployment/README.md`](deployment/README.md) | SSO, Infisical, Stripe, checklists |
| [`WEB_APPS.md`](WEB_APPS.md) | Canonical web vs legacy archive |
