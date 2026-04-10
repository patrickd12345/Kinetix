# Phase 4 — Release evidence log

**Last updated:** 2026-04-10 (post workspace-fix production deploy smoke)  
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

**Serverless incident + fix (same day):**

- Initial probes returned **500** + `X-Vercel-Error: FUNCTION_INVOCATION_FAILED` across `api/*`.
- Runtime log root cause (captured via `vercel logs --json`):  
  `ERR_MODULE_NOT_FOUND` for `/var/task/node_modules/@bookiji-inc/platform-auth/src/index.ts`.
- Fix applied: local workspace runtime packages now export `.js` entrypoints (`src/index.js`) instead of `.ts` entrypoints, then redeployed production.

**Post-fix probes (production):**

- `GET /api/admlog` -> **403** JSON (`disabled_in_production`) with request id.
- `POST /api/ai-chat` with `{}` -> **400** JSON (`invalid_request`), no invocation failure.

Interpretation: serverless invocation health restored for probed routes; admlog production-safety behavior now matches checklist expectations.

## Post workspace / `apps/rag` dependency fix — production deploy smoke (2026-04-10)

**Purpose:** Confirm production parity after PNPM workspace + `monorepo-packages/*` source-of-truth + explicit `@bookiji-inc/ai-runtime` on `@kinetix/rag`, before resuming Phase 4 manual gates.

**Deploy (Vercel production)**

| Field | Value |
|-------|--------|
| Deployment id | `dpl_7KEbEfYnUAqLdHNrKp3xMgMwWodF` |
| Inspector | `https://vercel.com/patrick-duchesneaus-projects/kinetix/7KEbEfYnUAqLdHNrKp3xMgMwWodF` |
| Primary probe host | `https://kinetix.bookiji.com` |
| CLI deploy | `vercel deploy --prod` from clean `main` at **`91d7c59`** (workspace rag dependency commit) |

**Endpoint smoke (read-only, `curl.exe`)**

| Endpoint | HTTP | Behavior |
|----------|------|----------|
| `GET /api/admlog` | **403** | JSON: admlog disabled in production; `requestId` present; **no** `FUNCTION_INVOCATION_FAILED` / `X-Vercel-Error` on sample |
| `POST /api/ai-chat` with `{}` | **400** | JSON `invalid_request` (`systemInstruction and contents are required.`); `Content-Type: application/json`; **no** invocation failure headers on sample |
| `GET /api/support-queue/tickets` | **200** | **`text/html`** SPA shell (`Content-Disposition: inline; filename="index.html"`), **not** JSON 401/403 |
| `GET /api/support-queue/kb-approval` | **200** | Same SPA **HTML** shell as tickets path |
| `POST /api/support-queue/tickets` with `{}` | **405** | Empty body (same inconsistent routing signal as prior evidence) |

**Parity verdict**

- **Confirmed** for shared-package **serverless runtime** on probed healthy API routes: `/api/admlog` and `/api/ai-chat` return expected JSON and show no invocation-failure signal on these probes.
- **`/api/support-queue/*` (anonymous GET)** remains **misaligned** with [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md) (expects JSON **403** for non-operator API). Behavior matches the **2026-04-10** blocker notes above (SPA fallback). Vercel deployment output lists lambdas under `api/support-queue/.../[[...segments]]`; public GET to the bare paths still does not surface JSON API responses in this check.

**Next action:** **investigate support-queue routing** (or path/method matching vs catch-all SPA rewrite) before treating operator API smoke as PASS; other Phase 4 manual gates can proceed in parallel only where independent.

## Manual production gates — execution record (2026-04-10)

**Environment:** `production` (`https://kinetix.bookiji.com`). **Scope:** manual verification and evidence updates only (no architecture changes).

### Step 1 — Run list (from canonical checklists)

**[`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md)**

1. Admlog: production `GET /api/admlog` must be **403** and must not instruct enabling `ADMLOG_ENABLED` in prod.
2. Infisical: `node scripts/verify-infisical.mjs --env=prod` must exit **0** and not flag `ADMLOG_ENABLED` in prod.
3. SSO happy path: Bookiji login, then Kinetix tab — no login wall; profile present; entitlement passes.
4. Entitlement gating: remove `kinetix` entitlement in DB for test user; refresh Kinetix — **Entitlement required** (no protected routes).
5. Optional: logout; open Kinetix; sign in via magic link/OAuth — return to Kinetix with profile + entitlement.
6. Supabase Auth (dashboard): providers + URL allowlist per [`ENV_PARITY.md`](deployment/ENV_PARITY.md).

**[`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md)**

1. Help Center (`/help`): KB load, `POST /api/ai-chat`, sources, escalation gate, ticket creation with confirmation + DB visibility.
2. Support queue (`/support-queue`): non-operator **403** on `GET /api/support-queue/tickets`; operator list with summary/slaMetrics; `?ticketId=`; PATCH flows; move-to-KB rules.
3. Operator dashboard (`/operator`): summary cards, links with filters.
4. KB staging: `GET /api/support-queue/kb-approval`, PATCH drafts, `POST .../approve-ingest`.
5. Escalation proxy (optional): Slack or documented no-op; UI resilient.

### Fail template (for any FAIL)

| Field | Value |
|-------|--------|
| Step | (exact checklist step) |
| Observed | (what happened) |
| Expected | (from checklist) |
| Likely cause | (hypothesis) |
| Severity | Blocker / Non-blocker |

---

## Manual: [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md)

| Step | Status | Evidence |
|------|--------|----------|
| Production `GET https://kinetix.bookiji.com/api/admlog` | **PASS** | **2026-04-10** (re-probe): **403** JSON `criteria":"disabled_in_production"`, `howToEnable` points to non-production only; `requestId` present. |
| `node scripts/verify-infisical.mjs --env=prod` | **PASS** | **2026-04-10**: exit **0** — `[verify:infisical] OK — env=prod platform_keys=8 kinetix_keys=0 supabase_url=set service_role_alias=yes` |
| SSO happy path (Bookiji tab then Kinetix) | **NOT RUN** | Requires interactive browser session across two origins (login/MFA takeover per runbook). Not executed in this automated session. |
| Post-login landing + entitlement pass (Coach/History/Settings) | **NOT RUN** | Blocked on SSO step. |
| Entitlement gating (remove `kinetix` in `platform.entitlements`) | **NOT RUN** | Requires DB toggle for a known test user plus authenticated Kinetix session. Not executed here. |
| Optional: login from kinetix subdomain | **NOT RUN** | Blocked on prior steps. |
| Supabase Auth dashboard (providers + URL config) | **NOT RUN** | Console verification; not performed in this session. |

## Manual: [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md)

| Section / step | Status | Evidence |
|----------------|--------|----------|
| 1. Help Center (full) | **NOT RUN** | Requires signed-in user + optional RAG/notification backends; not executed in this session. |
| 2. `GET /api/support-queue/tickets` non-operator | **FAIL** | **2026-04-10** `curl.exe` without auth cookies: **HTTP 200** `Content-Type: text/html`, body is SPA shell (`index.html`, `Content-Disposition: inline; filename="index.html"`). **Expected:** JSON **403** (or **401**) per smoke doc. **Likely cause:** `/api/support-queue/*` not served by deployed serverless handlers in this production deployment (static/SPA fallback). **Severity:** **Blocker** for operator smoke API gate until unauthenticated API calls return JSON errors, not the SPA document. |
| 2. Operator list / ticket PATCH / KB move rules | **NOT RUN** | Blocked: requires allowlisted operator session; also blocked until non-operator API behavior is corrected or explained. |
| 3. Operator dashboard | **NOT RUN** | Browser + feature flags. |
| 4. KB approval API | **NOT RUN** | `GET https://kinetix.bookiji.com/api/support-queue/kb-approval` without auth returned same **SPA 200** as tickets path (not JSON). Same routing concern as support-queue gate. |
| 5. Escalation proxy (optional) | **NOT RUN** | Not attempted. |

**Anonymous API control probes (same session, non-browser):**

- `POST https://kinetix.bookiji.com/api/ai-chat` with `{}` -> JSON `invalid_request` (handler reachable); aligns with prior post-fix probes.
- `POST https://kinetix.bookiji.com/api/support-queue/tickets` with `{}` -> **HTTP 405** empty body (differs from GET returning SPA; suggests routing is not consistently exposing this path as the JSON API expected by the smoke checklist).

### Blockers (production manual gates)

1. **Support queue / KB API routing on production:** Unauthenticated `GET` to `/api/support-queue/tickets` and `/api/support-queue/kb-approval` returns the SPA HTML document (**200**) instead of a JSON **403**/**401**. Treat as **blocker** for completing Phase 4 operator smoke as written until Vercel/`vercel.json`/`api/` deployment is verified for these routes.

2. **SSO + entitlement + operator UI:** Not executed here; remain **open** until interactive session + DB entitlement toggle are run.

### Non-blocking gaps

- Supabase Auth dashboard spot-check (operator console) still outstanding.
- Optional escalation proxy verification.

### Release recommendation (manual gate pass)

- **Not** "ready for next phase" for Phase 4 operator/support-queue **API** acceptance: **stop and fix** production routing or deployment coverage for `/api/support-queue/*` so API clients get JSON error responses, then re-run smoke **section 2–4**.
- **Proceed with caution** on unrelated surfaces: admlog + Infisical prod checks **PASS**; core `ai-chat` handler responds with JSON errors for bad requests.

**Umbrella `PROJECT_PLAN.md`:** Per Phase 4 plan, a full "all manual gates run" umbrella snapshot sync applies only when **every** intended manual step is executed. This session did **not** complete SSO, entitlement DB toggle, Help Center, or operator-authenticated flows; umbrella update is **minimal status only** (see umbrella file **Last updated**).

## Playwright (`pnpm test:e2e` from repo root)

| Result | Notes |
|--------|--------|
| **PASS** | **18 passed** (2026-04-10); `@playwright/test` via `apps/web` `webServer` + `VITE_SKIP_AUTH=1`. |

**Spec maintenance (same session, test drift vs local Vite):** allow **`/coaching`** in [`apps/web/e2e/internal-links-crawl.spec.ts`](../apps/web/e2e/internal-links-crawl.spec.ts) allowed-path set; treat **`404`** on `POST /api/ai-chat` in [`apps/web/e2e/ai-chat-smoke.spec.ts`](../apps/web/e2e/ai-chat-smoke.spec.ts) as expected when the dev server does not mount Vercel `api/*` (production still exercises the real handler).
