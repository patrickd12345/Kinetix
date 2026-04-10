# Kinetix remediation plan (full-system audit)

This plan consolidates findings from repository analysis, automated tests run in CI-like conditions, and code review. **Priority:** P0 (critical) → P3 (low). **Effort** is relative engineering scope (S/M/L), not calendar time.

---

# Execution Strategy

Remediation must follow this order:

1. Fix all P0 issues
2. Fix all P1 issues
3. Run full system audit again
4. Fix regressions discovered
5. Promote to next release candidate

**Rules:**

- No P1 fixes before P0 complete
- Run full test suite after each priority batch
- Commit fixes in small deterministic batches

---

# Exit Criteria

Release readiness requires:

- No P0 issues remaining
- No P1 issues remaining
- All UI paths tested
- No console runtime errors
- Accessibility tests passing
- Performance baseline acceptable
- Security checks passing
- Data integrity validated

---

# Verification Rules

Every remediation must include:

- Automated test if possible
- Manual verification steps
- Regression test if applicable
- UI validation if UI impacted

---

# Remediation Safety Rules

- Fixes must be incremental
- No large refactors during remediation
- Preserve behavior unless fixing bug
- Avoid introducing new dependencies unless necessary
- Run full test suite after each fix

---

# Progress Tracking

| Priority | Resolved | Total |
|----------|----------|-------|
| P0 Issues | 1 | 2 |
| P1 Issues | 0 | 3 |
| P2 Issues | 0 | 3 |
| P3 Issues | 0 | 2 |

**Last Updated:** 2026-04-10

**Audit Version:** 2 (production-grade plan structure)

---

## Issue Template

**Title:**

**Priority:** P0 / P1 / P2 / P3

**Description:**

**Risk:**

**Regression Risk:** Low / Medium / High

**Location:**

**Fix Recommendation:**

**Verification:**

**Estimated Effort:**

**Owner:** Agent / Human / Hybrid

---

## P0 — Critical

### P0-1: Remove or strictly gate debug telemetry in auth path

**Title:** Remove or strictly gate debug telemetry in auth path

**Priority:** P0

**Description:** `AuthProvider.tsx` previously contained `fetch` calls to a localhost debug ingest URL. That pattern can leak behavior in user browsers and is inappropriate for production.

**Risk:** Unintended data exfiltration, noise, or failure modes in strict networks.

**Regression Risk:** Low

**Location:** `apps/web/src/components/providers/AuthProvider.tsx` (removed in this branch).

**Fix Recommendation:** Keep removed; use `@bookiji-inc/observability` or env-guarded dev-only logging if needed.

**Verification:** Confirm no network calls to non-app origins on auth hydrate in production build; `pnpm test` and `pnpm exec playwright test` green; manual smoke login/session if applicable.

**Estimated Effort:** S (done).

**Owner:** Hybrid

---

### P0-2: Master access flags must never ship enabled in production

**Title:** Master access flags must never ship enabled in production

**Priority:** P0

**Description:** `VITE_MASTER_ACCESS` bypasses entitlement checks and forces feature flags on. `KINETIX_MASTER_ACCESS` allows operator API bypass for the Vite skip-auth token.

**Risk:** Full product and operator API exposure if env vars leak into production builds or server runtime.

**Regression Risk:** High

**Location:** `apps/web/src/lib/debug/masterAccess.ts`, `apps/web/src/lib/platformAuth.ts`, `apps/web/src/lib/featureFlags.ts`, `api/_lib/supportOperator.ts`, `apps/web/playwright.config.ts`.

**Fix Recommendation:** CI check: assert `VITE_MASTER_ACCESS` and `KINETIX_MASTER_ACCESS` absent in Vercel production; document in deployment runbook.

**Verification:** CI job or script fails if forbidden env vars present on production; manual Vercel dashboard check; re-run audit crawl only against non-production or with explicit allowlist.

**Estimated Effort:** S.

**Owner:** Hybrid

---

## P1 — High

### P1-1: Main JavaScript bundle near ~900 KB minified

**Title:** Main JavaScript bundle near ~900 KB minified

**Priority:** P1

**Description:** Vite build warns primary chunk exceeds 700 KB (`index-*.js` ~879 KB).

**Risk:** Slow load on mobile; poor Lighthouse performance.

**Regression Risk:** Medium

**Location:** `apps/web/vite.config.ts` (manualChunks), route components in `apps/web/src/pages/`.

**Fix Recommendation:** Lazy-load heavy routes (Coaching, Menu, Operator, Support queue); audit largest imports.

**Verification:** Compare `pnpm --filter @kinetix/web build` chunk sizes before/after; Lighthouse or bundle analyzer on preview URL; Playwright smoke on lazy-loaded routes.

**Estimated Effort:** M–L.

**Owner:** Hybrid

---

### P1-2: Empty `supabase` chunk in build output

**Title:** Empty `supabase` chunk in build output

**Priority:** P1

**Description:** Build emits `supabase-*.js` with 0 bytes.

**Risk:** Extra network round-trip / confusion; may indicate mis-splitting.

**Regression Risk:** Medium

**Location:** `apps/web/vite.config.ts` `manualChunks`.

**Fix Recommendation:** Adjust manualChunks so Supabase merges into main or a non-empty vendor chunk; verify tree-shaking.

**Verification:** Production build lists no zero-byte JS chunks; auth and data paths still work (Vitest + manual login smoke).

**Estimated Effort:** S–M.

**Owner:** Hybrid

---

### P1-3: Silent failure on RAG sync (`Layout.tsx`)

**Title:** Silent failure on RAG sync (`Layout.tsx`)

**Priority:** P1

**Description:** `syncNewRunsToRAG(...).catch(() => {})` swallows errors.

**Risk:** Users think data is indexed when RAG is broken.

**Regression Risk:** Medium

**Location:** `apps/web/src/components/Layout.tsx`.

**Fix Recommendation:** Surface a dismissible toast or settings diagnostic when sync fails N times; log to observability.

**Verification:** Unit or integration test with mocked RAG failure; manual trigger of failure path; confirm no unhandled rejection spam.

**Estimated Effort:** M.

**Owner:** Hybrid

---

## P2 — Medium

### P2-1: Coverage gate missing

**Title:** Coverage gate missing

**Priority:** P2

**Description:** No Istanbul/c8 report was generated in this audit.

**Risk:** Regressions slip through untested paths.

**Regression Risk:** Low

**Location:** `apps/web/package.json` test script.

**Fix Recommendation:** Add `vitest --coverage` with thresholds for `src/lib` and critical hooks.

**Verification:** CI fails below threshold; sample PR with coverage report artifact.

**Estimated Effort:** M.

**Owner:** Agent

---

### P2-2: Native apps not in automated UI audit

**Title:** Native apps not in automated UI audit

**Priority:** P2

**Description:** watchOS/iOS not executed in this environment.

**Risk:** Platform-specific regressions undetected.

**Regression Risk:** Medium

**Location:** `watchos/`, `ios/`.

**Fix Recommendation:** Xcode UI tests or screenshot baselines for critical flows (start run, pause, sync).

**Verification:** XCTest runs on CI or release checklist; manual device smoke for critical flows.

**Estimated Effort:** L.

**Owner:** Human

---

### P2-3: Lighthouse / real-device performance not measured here

**Title:** Lighthouse / real-device performance not measured here

**Priority:** P2

**Description:** No Lighthouse CI against deployed URL in this run.

**Risk:** Performance regressions in real network conditions.

**Regression Risk:** Low

**Location:** CI / preview deployment pipeline.

**Fix Recommendation:** Add Lighthouse CI on preview deployments.

**Verification:** Lighthouse job passes configured budgets on preview URL; compare scores across releases.

**Estimated Effort:** S–M.

**Owner:** Hybrid

---

## P3 — Low

### P3-1: Expand E2E click coverage

**Title:** Expand E2E click coverage

**Priority:** P3

**Description:** Audit crawl hits routes and primary nav; not every button/modal.

**Risk:** UI regressions in secondary actions.

**Regression Risk:** Low

**Location:** `apps/web/e2e/`.

**Fix Recommendation:** Add flows for Run dashboard modals, settings toggles, help search.

**Verification:** New Playwright specs pass in CI; optional flake review on retries.

**Estimated Effort:** M.

**Owner:** Agent

---

### P3-2: Security headers — CSP

**Title:** Security headers — CSP

**Priority:** P3

**Description:** `vercel.json` sets basic headers; CSP not verified.

**Risk:** XSS mitigation relies primarily on framework defaults.

**Regression Risk:** Medium

**Location:** `vercel.json`, `apps/web/index.html`.

**Fix Recommendation:** Add strict Content-Security-Policy compatible with Vite build hashes.

**Verification:** CSP evaluator tools; full app smoke (scripts, styles, API); staging before prod.

**Estimated Effort:** M.

**Owner:** Hybrid

---

## Audit harness delivered (keep)

| Artifact | Purpose |
|----------|---------|
| `apps/web/e2e/kinetix-audit-crawl.spec.ts` | Route sweep, screenshots, axe JSON, console capture |
| `apps/web/src/lib/debug/masterAccess.ts` | Explicit env-gated bypass for crawls (**default off**) |
| `docs/audit/*.md` | Reports and this plan |

**Playwright config** sets `VITE_MASTER_ACCESS=1` only for the webServer test harness — acceptable for CI; do not copy to production `.env`.
