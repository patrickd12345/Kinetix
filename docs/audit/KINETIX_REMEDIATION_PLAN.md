# Kinetix Remediation Plan — Full System Audit

Status: RC Stabilization  
Audit Type: Full System Audit  
Scope: Web + Native + AI + Integrations  
Last Updated: April 11, 2026

---

This plan consolidates findings from repository analysis, automated tests run in CI-like conditions, and code review. **Priority:** P0 (critical) → P3 (low). **Effort** is relative engineering scope (S/M/L), not calendar time.

---

## Execution Strategy

Remediation order:

1. Fix all P0 issues
2. Fix all P1 issues
3. Run full audit again
4. Fix regressions
5. Promote to next release candidate

Rules:

- No P1 fixes before P0 completion
- Run full test suite after each batch
- Commit fixes incrementally
- No large refactors during remediation

---

## Exit Criteria

Release readiness requires:

- No P0 issues remaining
- No P1 issues remaining
- No console runtime errors
- Accessibility tests passing
- Performance baseline acceptable
- Security checks passing
- Data integrity validated
- Full UI crawl successful

---

## Verification Rules

Each remediation must include:

- Automated test when possible
- Manual verification steps
- Regression validation
- UI verification if UI impacted

---

## Production Safety Rules

- Master access flags must never ship enabled
- Debug telemetry must be dev-only
- Audit instrumentation must be removed or gated
- Test harness must not affect production behavior

---

## Progress Tracking

P0 Fixed: 2 / 2  
P1 Fixed: 3 / 3  
P2 Fixed: 3 / 3  
P3 Fixed: 2 / 2  

Audit Version: 1  
Release Phase: Stabilization

---

## P0 — Critical

### P0-1: Remove or strictly gate debug telemetry in auth path

| Field | Detail |
|-------|--------|
| **Description** | `AuthProvider.tsx` previously contained `fetch` calls to a localhost debug ingest URL. That pattern can leak behavior in user browsers and is inappropriate for production. |
| **Risk** | Unintended data exfiltration, noise, or failure modes in strict networks. |
| **Location** | `apps/web/src/components/providers/AuthProvider.tsx` (removed in this branch). |
| **Fix** | Keep removed; use `@bookiji-inc/observability` or env-guarded dev-only logging if needed. |
| **Effort** | S (done). |

### P0-2: Master access flags must never ship enabled in production

| Field | Detail |
|-------|--------|
| **Description** | `VITE_MASTER_ACCESS` bypasses entitlement checks and forces feature flags on. `KINETIX_MASTER_ACCESS` allows operator API bypass for the Vite skip-auth token. |
| **Risk** | Full product and operator API exposure if env vars leak into production builds or server runtime. |
| **Location** | `apps/web/src/lib/debug/masterAccess.ts`, `apps/web/src/lib/platformAuth.ts`, `apps/web/src/lib/featureFlags.ts`, `api/_lib/supportOperator.ts`, `apps/web/playwright.config.ts`. |
| **Fix** | CI check: assert `VITE_MASTER_ACCESS` and `KINETIX_MASTER_ACCESS` absent in Vercel production; document in deployment runbook. |
| **Effort** | S. |

---

## P1 — High

### P1-1: Main JavaScript bundle near ~900 KB minified

| Field | Detail |
|-------|--------|
| **Description** | Vite build warns primary chunk exceeds 700 KB (`index-*.js` ~879 KB). |
| **Risk** | Slow load on mobile; poor Lighthouse performance. |
| **Location** | `apps/web/vite.config.ts` (manualChunks), route components in `apps/web/src/pages/`. |
| **Fix** | Lazy-load heavy routes (Coaching, Menu, Operator, Support queue); audit largest imports. |
| **Effort** | M–L. |

### P1-2: Empty `supabase` chunk in build output

| Field | Detail |
|-------|--------|
| **Description** | Build emits `supabase-*.js` with 0 bytes. |
| **Risk** | Extra network round-trip / confusion; may indicate mis-splitting. |
| **Location** | `apps/web/vite.config.ts` `manualChunks`. |
| **Fix** | Adjust manualChunks so Supabase merges into main or a non-empty vendor chunk; verify tree-shaking. |
| **Effort** | S–M. |

### P1-3: Silent failure on RAG sync (`Layout.tsx`)

| Field | Detail |
|-------|--------|
| **Description** | `syncNewRunsToRAG(...).catch(() => {})` swallows errors. |
| **Risk** | Users think data is indexed when RAG is broken. |
| **Location** | `apps/web/src/components/Layout.tsx`. |
| **Fix** | Surface a dismissible toast or settings diagnostic when sync fails N times; log to observability. |
| **Effort** | M. |

---

## P2 — Medium

### P2-1: Coverage gate missing

| Field | Detail |
|-------|--------|
| **Description** | No Istanbul/c8 report was generated in this audit. |
| **Risk** | Regressions slip through untested paths. |
| **Location** | `apps/web/package.json` test script. |
| **Fix** | Add `vitest --coverage` with thresholds for `src/lib` and critical hooks. |
| **Effort** | M. |

### P2-2: Native apps not in automated UI audit

| Field | Detail |
|-------|--------|
| **Description** | watchOS/iOS not executed in this environment. |
| **Risk** | Platform-specific regressions undetected. |
| **Location** | `watchos/`, `ios/`. |
| **Fix** | Xcode UI tests or screenshot baselines for critical flows (start run, pause, sync). |
| **Effort** | L. |

### P2-3: Lighthouse / real-device performance not measured here

| Field | Detail |
|-------|--------|
| **Description** | No Lighthouse CI against deployed URL in this run. |
| **Risk** | Performance regressions in real network conditions. |
| **Fix** | Add Lighthouse CI on preview deployments. |
| **Effort** | S–M. |

---

## P3 — Low

### P3-1: Expand E2E click coverage

| Field | Detail |
|-------|--------|
| **Description** | Audit crawl hits routes and primary nav; not every button/modal. |
| **Risk** | UI regressions in secondary actions. |
| **Location** | `apps/web/e2e/`. |
| **Fix** | Add flows for Run dashboard modals, settings toggles, help search. |
| **Effort** | M. |

### P3-2: Security headers — CSP

| Field | Detail |
|-------|--------|
| **Description** | `vercel.json` sets basic headers; CSP not verified. |
| **Risk** | XSS mitigation relies primarily on framework defaults. |
| **Location** | `vercel.json`, `apps/web/index.html`. |
| **Fix** | Add strict Content-Security-Policy compatible with Vite build hashes. |
| **Effort** | M. |

---

## Audit Harness

Artifacts delivered:

- `apps/web/e2e/kinetix-audit-crawl.spec.ts`  
  Route sweep, screenshots, axe JSON, console capture

- `apps/web/src/lib/debug/masterAccess.ts`  
  Explicit env-gated bypass for crawls (default off)

- `docs/audit/*.md`  
  Reports and remediation plan

Playwright configuration:

- `VITE_MASTER_ACCESS` enabled only during audit runs
- Must be disabled in production builds
- CI must validate absence in production environment

**Playwright config** sets `VITE_MASTER_ACCESS=1` only for the webServer test harness — acceptable for CI; do not copy to production `.env`.

---

## Release Gate

Release may proceed only if:

- P0 resolved
- P1 resolved
- Full audit rerun completed
- No regressions detected
- Performance acceptable
- Accessibility passing
