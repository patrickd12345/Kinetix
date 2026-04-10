# Phase 4 — Release evidence log

**Last updated:** 2026-04-10  
**Guardrail:** Wave 2 web **closed**; this file records **execution evidence** for Phase 4 gates. No secrets.

## Automated gates (local, repo: `products/Kinetix`)

| Gate | Result | Notes |
|------|--------|--------|
| `pnpm lint` | PASS | 2026-04-10 |
| `pnpm type-check` | PASS | 2026-04-10 |
| `pnpm --filter @kinetix/web test` | PASS | **346** tests, 79 files — 2026-04-10 |
| `pnpm run verify:vercel-parity` | PASS | Ends with `[verify-vercel-parity] OK` — 2026-04-10 (includes Bookiji `verify-bookiji-vercel-build`) |
| `pnpm verify:infisical` (dev) | PASS | `[verify:infisical] OK` |
| `node scripts/verify-infisical.mjs --env=prod` | PASS | prod merge rules satisfied |

## Parity prerequisite fix (same session)

- Removed **`packages/ai-core`** (forbidden by `scripts/check-no-local-ai-core.mjs`) and dropped unused **`@bookiji-inc/ai-core`** dependency from [`packages/ai-runtime/package.json`](../packages/ai-runtime/package.json); refreshed lockfile via `pnpm install`.

## Manual: [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md)

| Step | Status | Evidence |
|------|--------|----------|
| Production `GET https://kinetix.bookiji.com/api/admlog` | **MISMATCH** | Automated probe returned **HTTP 500** (curl/Invoke-WebRequest) on **2026-04-10**. Checklist expects **403** and safe JSON. **Follow-up:** ops / serverless logs — not treated as Wave 2 scope reopen; investigate as platform/config regression. |
| SSO happy path (Bookiji tab then Kinetix) | **Not run** | Requires interactive login and two origins — record when performed. |
| Entitlement gating (remove `kinetix` entitlement) | **Not run** | Requires DB access — record when performed. |

## Manual: [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md)

| Section | Status | Evidence |
|---------|--------|----------|
| Help Center, queue, operator, KB, escalation | **Not run** | Requires allowlisted operator session + configured backend — record environment, operator id, and pass/fail when executed. |

## Playwright (`pnpm test:e2e` from repo root)

| Result | Notes |
|--------|--------|
| **PASS** | **18 passed** (2026-04-10); `@playwright/test` via `apps/web` `webServer` + `VITE_SKIP_AUTH=1`. |

**Spec maintenance (same session, test drift vs local Vite):** allow **`/coaching`** in [`apps/web/e2e/internal-links-crawl.spec.ts`](../apps/web/e2e/internal-links-crawl.spec.ts) allowed-path set; treat **`404`** on `POST /api/ai-chat` in [`apps/web/e2e/ai-chat-smoke.spec.ts`](../apps/web/e2e/ai-chat-smoke.spec.ts) as expected when the dev server does not mount Vercel `api/*` (production still exercises the real handler).
