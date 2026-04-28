# Kinetix Scope Closure

Last updated: 2026-04-27

**Current phase:** Phase 3 (Platform Hardening) — audit-first; **does not** reopen Wave 2 web scope.

## Wave 1

- Status: Completed
- Surfaces: Verified (Authentication / Access, Layout / Navigation, Help Center, History)
- Evidence: `pnpm --filter @kinetix/web test -- src/integration/auth-entitlement.integration.test.ts src/integration/app-entry-guard.integration.test.ts src/integration/menu-route.integration.test.ts src/integration/help-route.integration.test.ts src/integration/help-center-support.integration.test.ts src/pages/History.integration.test.tsx` -> 6 passed files, 17 passed tests

## Wave 2 — Web Closure

Status: CLOSED  
Feature Freeze: ENABLED  
Scope Reopen Policy: Bug fixes only  

### Closure Evidence

- `pnpm --filter @kinetix/web test` -> **79 files, 346 tests** (closure record **2026-04-10**). Current suite size increases over time; see latest snapshot in [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md).
- `pnpm lint` -> clean
- `pnpm type-check` -> clean
- `pnpm run verify:vercel-parity` -> PASS (2026-04-10)

**Additional verification detail (same recorded run):** `pnpm --filter @kinetix/web test` runs `build:bookiji-packages`, `@kinetix/core` build, then `vitest run`. Supporting checks: `pnpm lint` (clean), `pnpm type-check` (clean). Pre-ship parity: `pnpm run verify:vercel-parity` **PASS** (2026-04-10; script ends with `[verify-vercel-parity] OK`; covers `check-no-local-ai-core`, `scripts/vercel-install.sh`, root `type-check`, `lint`, `build`, and Bookiji `verify-bookiji-vercel-build`). Full baseline: [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md).

## Release Candidate baseline

Release Candidate: kinetix-rc-1  
Date: 2026-04-11  
Phase: Stabilization  

# Kinetix Scope Closure Tracker

**Maintenance Rule:** This document must be updated whenever a feature is completed, whenever scope is reduced, whenever integration begins, and whenever verification completes. This file is the authoritative closure tracker.

## Status Legend

- Closed
- Soft Freeze
- Open Build
- Integration Testing
- Verified (test-backed in-repo; production env may still gate live flows)

Symbols used in sections below: Verified = in-repo tests green for this wave; Soft Freeze = intentionally limited or env-dependent.

---

# Core Product Surfaces

## Authentication / Access

Status: Verified
Owner: Engineering
Closure Criteria: Entitlement + auth flows covered by integration tests; no unconditional hook violations in coaching context consumers.
Remaining: None in-repo; production OAuth env parity per deployment docs.
Integration Notes: `src/integration/auth-entitlement.integration.test.tsx`, `src/lib/platformAuth.test.ts`

## Billing

Status: Verified
Owner: Engineering
Closure Criteria: Checkout return routes render; billing helpers behave per `kinetixBilling` tests; live Stripe still env-gated.
Remaining: Production: `BILLING_ENABLED`, Stripe price id, Bookiji webhook path per `docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md`.
Integration Notes: `src/integration/billing-return-routes.integration.test.tsx`, `src/lib/kinetixBilling.test.ts`

## Onboarding

Status: Verified
Owner: Engineering
Closure Criteria: App does not crash when authenticated with missing profile; hydration messaging is deterministic.
Remaining: None in-repo for the guarded path.
Integration Notes: `src/integration/app-entry-guard.integration.test.tsx`

## History

Status: Verified
Owner: Engineering
Closure Criteria: History route integration tests pass; KPS contract tests green.
Remaining: None for tracked closure scope.
Integration Notes: `src/pages/History.integration.test.tsx`, `src/lib/kpsUtils.contract.test.ts`

## Coaching

Status: Verified
Owner: Engineering
Closure Criteria: Coaching page renders; deterministic coaching engines unit-tested; `KinetixCoachingContext` uses Rules-of-Hooks-safe merged hook (`useKinetixCoachingContext` + `useKinetixCoachingContextState`).
Remaining: Performance follow-up: merged hook may invoke state computation more often than the old short-circuit (documented tradeoff for lint correctness).
Integration Notes: `src/pages/Coaching.test.tsx`, `src/lib/coach/coachEngine.test.ts`, `src/context/KinetixCoachingContextProvider.test.tsx`

## Intelligence Engine

Status: Verified
Owner: Engineering
Closure Criteria: Intelligence engine unit tests pass; health metric signals compile and narrow canonical metrics safely.
Remaining: Optional E2E when AI gateway env is available.
Integration Notes: `src/lib/intelligence/intelligenceEngine.test.ts`, `src/lib/intelligence/healthMetricSignals.ts`

## Withings Integration

Status: Verified
Owner: Engineering
Closure Criteria: OAuth/sync policy/unit tests pass; startup sync test does not require IndexedDB when DB helpers are stubbed.
Remaining: Live OAuth redirect and token refresh in staging per `FEATURES_WEB.md`.
Integration Notes: `src/lib/withings.test.ts`, `src/lib/integrations/withings/syncPolicy.test.ts`, `src/lib/withingsOAuthServer.test.ts`, `src/store/settingsStore.withingsSync.test.ts`

## Help Center

Status: Verified
Owner: Engineering
Closure Criteria: Help routes and support-queue integrations pass; escalation contracts documented.
Remaining: Production operator manual pass per `docs/HELP_CENTER_OPERATIONS.md`.
Integration Notes: `src/integration/help-route.integration.test.tsx`, `src/integration/help-center-support.integration.test.tsx`, `src/integration/support-queue.integration.test.tsx`

## Settings

Status: Verified
Owner: Engineering
Closure Criteria: Theme and Withings-related settings stores tested.
Remaining: Full settings E2E optional.
Integration Notes: `src/store/themeStore.test.ts`, `src/store/settingsStore.withingsSync.test.ts`

## Layout / Navigation

Status: Verified
Owner: Engineering
Closure Criteria: Menu route integration passes.
Remaining: None in-repo for tracked closure scope.
Integration Notes: `src/integration/menu-route.integration.test.tsx`

---

# Platform Hardening

## Deterministic Layer

Status: Verified
Owner: Engineering
Closure Criteria: KPS and coaching math remain in `@kinetix/core` / pure TS modules with contract tests; no LLM-sourced numeric truth for KPS display.
Remaining: None for Wave 2 closure.
Integration Notes: `KPS_CONTRACT.md`, `src/lib/kpsUtils.contract.test.ts`, `packages/core` (build included in web test script)

## Hallucination Control

Status: Verified
Owner: Engineering
Closure Criteria: Chat math gate tests pass; documented fail-closed policy for ambiguous fitness math.
Remaining: Expand API surface coverage if new chat endpoints are added.
Integration Notes: `docs/architecture/LLM_MATH_GUARDRAILS.md`, `api/_lib/ai/chatMathGate.test.ts`

## Error Contracts

Status: Soft Freeze
Owner: Engineering
Closure Criteria: Shared `@bookiji-inc/error-contract` available; API route tests cover critical paths (`src/test/ai-route-errors.test.ts`, escalation routes).
Remaining: Uniform adoption across every `api/*` handler (see `PRODUCT_SCOPE.md` row). Tracked under **Phase 3 — Platform Hardening** (not blocking release).
Integration Notes: `apps/web/src/test/ai-route-errors.test.ts`, `api/_lib/*` consumers

---

# Integration Testing Plan

1. Core surface validation and cross-surface handoff checks (Wave 1 + Wave 2 Vitest evidence above).
2. Platform hardening verification under integrated runtime flows (math gate, escalation, billing return routes).
3. End-to-end regression sweep and release-candidate signoff (Playwright / operator checklist; **Phase 4 — Release Readiness**).

---

# Global Closure Criteria

- No schema changes pending for this wave (none asserted here; platform migrations remain umbrella-owned per `docs/PROJECT_PLAN.md`).
- No architecture rewrite pending for coaching context (Rules-of-Hooks refactor completed with tests).
- Only bug fixes remaining for verified surfaces unless product expands scope.
- UI stable for verified routes under test.

---

# Overall Status

Feature Completion: **Wave 2 web closure: CLOSED** (feature freeze active; scope reopen only for bug fixes or explicit product decision). Verified web test-backed surfaces above; native iOS/watch tracked separately in `FEATURES_PHONE.md` / `FEATURES_WATCH.md`.
Integration Readiness: Web Vitest suite green (re-run `pnpm --filter @kinetix/web test`; counts in [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md)); coaching context + Withings/sync policy + billing return routes verified in-repo; Vercel-style parity gate green (`pnpm run verify:vercel-parity`, 2026-04-10).
Production Readiness: **Phase 4 — Release Readiness** — deployment checklist (`docs/deployment/KINETIX_VERIFICATION_CHECKLIST.md`), real Stripe/Supabase/operator passes, and environment parity (`docs/deployment/ENV_PARITY.md`). Automated gate evidence: [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) (manual production probes may still be pending).

---

# Phase 3 — Platform Hardening

Status: Not Blocking Release

- Error contract rollout (uniform `@bookiji-inc/error-contract` adoption across `api/*` where not yet uniform)
- Observability consistency across API and app paths
- Feature flag governance
- CI beyond web (native / RAG job coverage where applicable)
- Env contract uniformity

Pointers: [`PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) platform table (Partial rows); [`PROJECT_PLAN.md`](PROJECT_PLAN.md) next focus.

---

# Phase 4 — Release Readiness

Status: **Day-1 closure prep complete (2026-04-27 agent run); operator interactive rows still required.**

- ENV parity verification — [`docs/deployment/ENV_PARITY.md`](deployment/ENV_PARITY.md)
- Operator smoke tests — [`docs/HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md)
- Deployment checklist — [`docs/deployment/KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md)
- **Interactive runbook (entry point):** [`docs/PHASE4_INTERACTIVE_RUNBOOK.md`](PHASE4_INTERACTIVE_RUNBOOK.md)
- **Web release runbook (tag + promote + probes):** [`docs/PHASE4_RELEASE_RUNBOOK.md`](PHASE4_RELEASE_RUNBOOK.md)
- **Playwright E2E:** local 43 passed / 3 skipped; CI workflow [`.github/workflows/web-e2e.yml`](../.github/workflows/web-e2e.yml)
- **Lane A native contract (2026-04-27 PM):** `GET /api/entitlements` + `POST /api/platform-profile/sync` in [`api/`](../api/) (`api/entitlements/index.ts`, `api/platform-profile/sync/index.ts`).
- **Native (Lane B):** all seven steps shipped on `feat/native-store-ready` (worktree `Kinetix-native`); server routes above unblock `EntitlementService` — device audit + TestFlight + merge remain operator tasks per [`docs/IOS_LAUNCH_CHECKLIST.md`](IOS_LAUNCH_CHECKLIST.md)
- **Garmin Connect (Lane C):** parked on partner approval. Application brief: [`docs/GARMIN_CONNECT_APPLICATION_BRIEF.md`](GARMIN_CONNECT_APPLICATION_BRIEF.md). Post-approval steps: [`docs/GARMIN_POST_APPROVAL_RUNBOOK.md`](GARMIN_POST_APPROVAL_RUNBOOK.md)
- **Operations (Lane D):** [`INCIDENT_RUNBOOK.md`](INCIDENT_RUNBOOK.md), [`STATUS_PAGE_SETUP.md`](STATUS_PAGE_SETUP.md), [`PRIVACY_TOS_LAUNCH_REVIEW.md`](PRIVACY_TOS_LAUNCH_REVIEW.md), [`PHASE4_LAUNCH_COMMS.md`](PHASE4_LAUNCH_COMMS.md)

---

# Phase 5 — Post Launch Enhancements

- Map and export (GPX/TCX) on web — [`FEATURES_WEB.md`](../FEATURES_WEB.md)
- Production-tier billing UX end-to-end
- AI reliability improvements (gateway envs, E2E allowances when AI gateway missing)
- Optional features and backlog items not required for Wave 2 web closure
