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

## Production probes (automated, read-only)

**SPA:** `GET https://kinetix.bookiji.com/` returned **200** (2026-04-10).

**Serverless (`api/*`):** Probed routes returned **500** with **`X-Vercel-Error: FUNCTION_INVOCATION_FAILED`** and body `FUNCTION_INVOCATION_FAILED` (plain text), including:

- `GET /api/admlog`
- `POST /api/ai-chat` (minimal JSON body)
- `GET /api/strava-proxy` (sample query)

Interpretation: this is a **Vercel function invocation failure for the whole `api/*` deployment surface**, not a JSON **403** from [`api/admlog/index.ts`](../api/admlog/index.ts) alone. Until functions boot successfully, the admlog production-safety check in [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md) cannot be satisfied via HTTP.

**Ops next (no repo secrets here):** Vercel project **Functions** logs for `api/*`, confirm **Node** matches `package.json` `engines` (22.x), confirm **install/build** output includes serverless dependencies (`scripts/vercel-install.sh` path), and verify required **server env** for API routes (Supabase keys, etc.) in the deployment environment that runs functions.

## Manual: [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md)

| Step | Status | Evidence |
|------|--------|----------|
| Production `GET https://kinetix.bookiji.com/api/admlog` | **Blocked / mismatch** | See **Production probes** above: **500** + `FUNCTION_INVOCATION_FAILED` (2026-04-10). Once functions are healthy, re-check for **403** + safe JSON per checklist (admlog must stay disabled in production per [`ENV_PARITY.md`](deployment/ENV_PARITY.md)). |
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
