# Phase 4 — Release evidence log

**Last updated:** 2026-04-10 (gate A3 Vitest **PASS**; **Bookiji prod** `GET https://app.bookiji.com/api/auth/health-check` now **`{"ok":true,"status":200}`** after Vercel publishable-key correction + `app.bookiji.com` alias repoint; **interactive** Phase 4 rows still **NOT RUN** — human OAuth/DB/Supabase/operator session required; see **Interactive closure session (2026-04-10 continuation)**)  
**Guardrail:** Wave 2 web **closed**; this file records **execution evidence** for Phase 4 gates. No secrets.

## Phase 4 consolidated manual gate run order

Single execution order for [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md) and [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md):

1. **Automated / CLI (no browser):** `GET /api/admlog`, `node scripts/verify-infisical.mjs --env=prod`, anonymous `GET`/`POST` control probes on `/api/support-queue/*`, `POST /api/ai-chat` minimal body.
2. **SSO happy path + post-login landing:** Bookiji login, then `https://kinetix.bookiji.com` — no login wall; Coach/History/Settings (or equivalent) accessible.
3. **Entitlement gating:** remove `kinetix` row in `platform.entitlements` for test user; refresh Kinetix — **Entitlement required**.
4. **Optional logout / login from Kinetix subdomain:** magic link or OAuth; land on Kinetix with profile + entitlement.
5. **Supabase Auth (dashboard):** providers + URL allowlist per [`ENV_PARITY.md`](deployment/ENV_PARITY.md).
6. **Help Center `/help`:** KB, `POST /api/ai-chat`, sources, escalation gate, ticket after confirmation + DB row.
7. **Support queue:** non-operator **403** on list API (already scriptable); then **operator** list with `summary`/`slaMetrics`, `?ticketId=`, PATCH, move-to-KB rules.
8. **Operator dashboard `/operator`:** cards + filter deep links.
9. **KB approval:** operator `GET` list; PATCH drafts; `POST .../approve-ingest` (or documented 503).
10. **Escalation proxy (optional):** Slack or documented `204` no-op; UI does not crash.

## Automated gates (local, repo: `products/Kinetix`)

| Gate | Result | Notes |
|------|--------|--------|
| `pnpm lint` | PASS | 2026-04-10; re-run **PASS** same day (Phase 4 evidence session) |
| `pnpm type-check` | PASS | 2026-04-10; re-run **PASS** same day (Phase 4 evidence session) |
| `pnpm --filter @kinetix/web test` | PASS | **346** tests, 79 files — 2026-04-10 after fix: [`apps/web/vitest.config.ts`](../apps/web/vitest.config.ts) aliases `@bookiji-inc/*` -> `../../monorepo-packages/<pkg>/src` (was stale `../../packages/*`). |
| `pnpm run verify:vercel-parity` | PASS | Ends with `[verify-vercel-parity] OK` — 2026-04-10 (includes Bookiji `verify-bookiji-vercel-build`) |
| `pnpm verify:infisical` (dev) | PASS | `[verify:infisical] OK` |
| `node scripts/verify-infisical.mjs --env=prod` | PASS | prod merge rules satisfied |
| `pnpm test:e2e` | PASS | **18 passed** (Playwright) — includes `/help`, `/support-queue`, `/operator` UI paths in local smoke environment. |

**Production probe snapshot (2026-04-10, read-only):**

- `GET /api/admlog` -> **403**
- `POST /api/ai-chat` with `{}` -> **400**
- `GET /api/support-queue/tickets` -> **403**
- `GET /api/support-queue/kb-approval` -> **403**
- `GET /help` -> **200** SPA shell (auth redirect occurs client-side after app boot)
- `GET /operator` -> **200** SPA shell (auth redirect occurs client-side after app boot)

**Production API probes reconfirmed (same session, `curl.exe`):** `admlog` **403**, `ai-chat` POST `{}` **400**, `support-queue/tickets` **403**, `kb-approval` **403**.

## Interactive closure session (2026-04-10 continuation)

**Scope:** Execute remaining items from [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md) and [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md) that require **authenticated** production access, **Supabase project dashboard**, **SQL** on `platform.entitlements`, or an **allowlisted operator** user.

**Agent limitation:** This session cannot complete Google OAuth, email magic-link inbox flows, dashboard login, or database edits. Evidence below is **PASS / NOT RUN / partial observation** with explicit blockers.

### Chrome DevTools MCP (production URLs)

| Step | Result | Evidence / blocker |
|------|--------|-------------------|
| Open `https://app.bookiji.com/login` | **PARTIAL** | Page title **Bookiji - Universal Booking Platform**; heading **Sign in to your account**; **Sign in with Google** present. **Update 2026-04-10:** prod **`/api/auth/health-check`** fixed (wrong publishable key + stale `app.bookiji.com` alias); re-test **Sign in with Google** / magic link in a normal browser for SSO gate closure. |
| Open `https://kinetix.bookiji.com/login` | **PARTIAL** | **KINETIX** heading; **Continue with email**, email field, **Send magic link** (disabled until email). **No** Bookiji-style auth-unreachable banner in this snapshot. **Magic link not sent** (no inbox access). |

### Checklist mapping ([`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md))

| Checklist item | Status | Evidence / blocker |
|----------------|--------|-------------------|
| SSO + entitlement happy path (Bookiji then Kinetix, no login wall) | **NOT RUN** | Requires completed Bookiji session + Kinetix tab verification. No authenticated session established in this session. |
| Entitlement gating (remove `kinetix` in `platform.entitlements`) | **NOT RUN** | Requires Supabase SQL Editor or service-role path + test user id; not executed here. |
| Optional: login from Kinetix subdomain | **NOT RUN** | Requires magic link or OAuth completion end-to-end. |
| Supabase Auth dashboard (providers + URL allowlist) | **NOT RUN** | Requires human Supabase org login; not performed here. |

### Operator smoke mapping ([`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md))

| Section | Status | Evidence / blocker |
|---------|--------|-------------------|
| 1 Help Center full (KB, ai-chat, sources, escalation, ticket + DB) | **NOT RUN** | Requires signed-in end-user; anonymous API probes only. |
| 2 Support queue (operator list, PATCH, move-to-KB, etc.) | **NOT RUN** (except known anonymous 403) | Non-operator **403** already **PASS** via `curl`. Operator JWT + ticket ids not available to agent. |
| 3 Operator dashboard UI | **NOT RUN** | Requires signed-in operator (`KINETIX_SUPPORT_OPERATOR_USER_IDS`). |
| 4 KB approval (operator GET/PATCH/approve-ingest) | **NOT RUN** | Same as operator session. |
| 5 Escalation proxy (optional) | **NOT RUN** | Needs configured webhooks + signed-in operator context. |

**Conclusion:** Scripted/anonymous production gates remain **PASS**. **Full Phase 4 manual sign-off** is still **blocked** on human-interactive rows above.

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

## Support-queue API routing fix (2026-04-10)

**Problems**

1. **SPA rewrite:** `vercel.json` used `"/(.*)"` -> `/index.html`, so `/api/support-queue/*` was served as the Vite SPA (**200** `text/html`) instead of serverless JSON.
2. **Bare list paths:** After narrowing the SPA rewrite to `/((?!api/).*)` -> `/index.html`, anonymous `GET` to `/api/support-queue/tickets` and `/api/support-queue/kb-approval` returned platform **404** JSON: nested `api/support-queue/tickets/[[...segments]].ts` did not bind the directory root (no `index` route), and `req.query.segments` was not populated for the consolidated optional catch-all in production.

**Fix (minimal, Hobby plan)**

- Keep SPA fallback: [`vercel.json`](../vercel.json) `source` `/((?!api/).*)` -> `/index.html` so `/api/**` is not rewritten to the SPA.
- **Single function** for all support-queue HTTP: [`api/support-queue/[[...segments]].ts`](../api/support-queue/[[...segments]].ts) dispatches `tickets` vs `kb-approval` (removes two nested `[[...segments]]` bundles and avoids extra `index.ts` routes that would exceed the **12 serverless function** Hobby cap).
- **Segment resolution:** If `req.query.segments` is missing, derive segments from `req.url` pathname after `/api/support-queue/` so list and sub-routes match reliably.

**Deploy (Vercel production)**

| Field | Value |
|-------|--------|
| Deployment id | `dpl_HdeZzNuPDg8UgAoXLBppcg1ds5ip` |
| Inspector | `https://vercel.com/patrick-duchesneaus-projects/kinetix/HdeZzNuPDg8UgAoXLBppcg1ds5ip` |
| Primary probe host | `https://kinetix.bookiji.com` |

**Post-fix probes (anonymous `curl.exe`, production)**

| Endpoint | HTTP | Notes |
|----------|------|--------|
| `GET /api/support-queue/tickets` | **403** | JSON `code":"forbidden"`, `Support operator access required`; **not** SPA HTML |
| `GET /api/support-queue/kb-approval` | **403** | Same JSON contract as tickets list |
| `POST /api/support-queue/tickets` with `{}` | **405** | List route allows **GET** only; `method_not_allowed` JSON (expected) |

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
- **`/api/support-queue/*` (anonymous GET)** was **misaligned** in this snapshot (SPA HTML **200** on bare paths). **Superseded** by the **Support-queue API routing fix (2026-04-10)** section above: production anonymous `GET` now returns JSON **403** on list routes.

**Next action (historical):** addressed by merged `api/support-queue/[[...segments]].ts` + SPA rewrite exclusion; re-run operator-authenticated smoke per [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md) when ready.

## Manual production gates — execution record (2026-04-10)

**Environment:** `production` (`https://kinetix.bookiji.com`). **Scope:** manual verification and evidence updates only (no architecture changes).

### Interactive production browser probes (anonymous session, 2026-04-10)

**Tool:** Cursor IDE browser (no prior Bookiji/Kinetix auth cookies). **Purpose:** Record what an unauthenticated visitor sees; **does not** satisfy checklist steps that require a signed-in user, Bookiji-first SSO, DB entitlement edits, Supabase console access, or an allowlisted operator.

| Probe | Result | Evidence |
|-------|--------|----------|
| `GET https://kinetix.bookiji.com/` | **Redirect** | Final URL `https://kinetix.bookiji.com/login?next=%2F` — Kinetix login (magic link email UI: **Continue with email**, **Send magic link**). |
| `GET https://kinetix.bookiji.com/help` | **Redirect** | `https://kinetix.bookiji.com/login?next=%2Fhelp` — Help Center full smoke **not** reachable without sign-in in this session. |
| `GET https://kinetix.bookiji.com/support-queue` | **Redirect** | `https://kinetix.bookiji.com/login?next=%2Fsupport-queue` — operator queue UI **not** exercised without auth. |
| `GET https://kinetix.bookiji.com/operator` | **Redirect** | `https://kinetix.bookiji.com/login?next=%2Foperator` — operator dashboard **not** exercised without auth. |

**Interpretation:** Protected routes preserve `next` for post-login return. Full **PHASE4_OPERATOR_SMOKE** and entitlement/SSO checklist items still require **authenticated** sessions (and operator allowlist / DB / console where specified).

**This session (agent):** **CLI/curl** and **Infisical prod** checks below are **PASS**. **Supabase dashboard**, **DB entitlement toggle**, **Bookiji-then-Kinetix SSO happy path**, **Help Center end-to-end**, **operator-authenticated API/UI**, and **optional escalation** were **not** completed here (credentials / email magic link / operator allowlist / RAG+DB not available in this environment).

### Authenticated production closure attempt (Cursor browser MCP, 2026-04-10)

**Tool:** Cursor IDE browser MCP. **Checklist note:** [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md) references `https://bookiji.com`; production **app** sign-in used **`https://app.bookiji.com/login`** (Google OAuth). Marketing `https://www.bookiji.com/` has no app login.

**Preconditions (this session):**

- **Operator allowlist (`KINETIX_SUPPORT_OPERATOR_USER_IDS`):** Not verified against live Vercel env from the repo (no secret dump). Operator-authenticated smoke remains **NOT RUN** until a known allowlisted user completes it in a real browser.
- **Entitlement DB toggle + Supabase console:** Require human dashboard/DB access; **NOT RUN** here.

**Bookiji app — Google sign-in probe**

| Step | Result | Evidence |
|------|--------|----------|
| Open `https://app.bookiji.com/login` | **PASS** (page load) | Snapshot: heading **Sign in to your account**; control **Sign in with Google** (`ref` interaction). |
| Click **Sign in with Google** | **Did not reach authenticated state** | Button showed **Signing in...** then returned to **Sign in with Google**; URL remained `https://app.bookiji.com/login`. Google account selection / OAuth completion did not finish in MCP within the probe window — **no session cookie** established for downstream SSO. |

**Kinetix — second tab after Bookiji probe**

| Step | Result | Evidence |
|------|--------|----------|
| Open `https://kinetix.bookiji.com/` | **Login wall** | Final URL `https://kinetix.bookiji.com/login?next=%2F` — **no** shared authenticated session from Bookiji tab (expected until Bookiji login completes). |

**Downstream interactive gates (all NOT RUN — blocked on auth / human steps)**

| Gate | Status | Blocker |
|------|--------|--------|
| Bookiji-first SSO then Kinetix without login wall | **NOT RUN** | OAuth did not complete on `app.bookiji.com/login` in MCP; Kinetix stayed on `/login`. |
| Post-login landing / entitlement pass | **NOT RUN** | No signed-in Kinetix session. |
| Entitlement DB toggle | **NOT RUN** | Human DB access not exercised. |
| Optional: login from Kinetix subdomain | **NOT RUN** | No completed prior auth; magic link/OAuth not run end-to-end. |
| Supabase Auth console | **NOT RUN** | Human Supabase project console not used in this session. |
| Help Center E2E | **NOT RUN** | Requires signed-in user. |
| Operator queue / dashboard / KB actions / optional escalation | **NOT RUN** | Requires signed-in **allowlisted** operator session. |

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
| Production `GET https://kinetix.bookiji.com/api/admlog` | **PASS** | **2026-04-10** (this session re-probe): **403** JSON; `howToEnable` explicitly says admlog is not available in production and not to enable `ADMLOG_ENABLED` on Vercel Production; `requestId` e.g. `fb441633-704f-49bc-ae4f-9512a318b725`. |
| `node scripts/verify-infisical.mjs --env=prod` | **PASS** | **2026-04-10** (this session): exit **0** — `[verify:infisical] OK — env=prod platform_keys=8 kinetix_keys=0 supabase_url=set service_role_alias=yes` |
| SSO happy path (Bookiji tab then Kinetix) | **NOT RUN** | **2026-04-10 continuation:** Chrome DevTools MCP reached `app.bookiji.com/login` (Google button visible; **Auth service unreachable** banner in snapshot — verify in normal browser). No OAuth completion; no shared session. See **Interactive closure session (2026-04-10 continuation)**. |
| Post-login landing + entitlement pass (Coach/History/Settings) | **NOT RUN** | No authenticated Kinetix session. |
| Entitlement gating (remove `kinetix` in `platform.entitlements`) | **NOT RUN** | No SQL/dashboard entitlement edit in this session. |
| Optional: login from kinetix subdomain | **NOT RUN** | Kinetix login page observed (magic link UI); end-to-end sign-in not completed. |
| Supabase Auth dashboard (providers + URL config) | **NOT RUN** | Dashboard not opened in this session. |

## Manual: [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md)

| Section / step | Status | Evidence |
|----------------|--------|----------|
| 1. Help Center (full) | **NOT RUN** | Requires signed-in end-user session. Authenticated MCP attempt did not establish session (see **Authenticated production closure attempt**). |
| 1a. KB loads / ai-chat / sources / escalation gate / ticket + DB | **NOT RUN** | Sub-items of section 1; blocked on auth. |
| 2. `GET /api/support-queue/tickets` non-operator | **PASS** | **2026-04-10** (this session): anonymous `curl.exe` -> **403** JSON `code":"forbidden"`, `Support operator access required`; `requestId` e.g. `736ff394-a0a2-4994-b3e4-d131c830f6a6`; **not** SPA HTML. (Historical pre-fix SPA **200** superseded by support-queue routing fix.) |
| 2b. Operator list `summary` + `slaMetrics` | **NOT RUN** | Needs allowlisted operator JWT. |
| 2c. Deep link `?ticketId=` | **NOT RUN** | Needs operator session + ticket id. |
| 2d. PATCH status / notes / assignment | **NOT RUN** | Needs operator session. |
| 2e. Move to KB approval (resolved-only rule) | **NOT RUN** | Needs operator session + ticket state. **Support-queue routing blocker is resolved** for anonymous `GET` list API; operator-authenticated steps still **NOT RUN**. |
| 3. Operator dashboard | **NOT RUN** | Anonymous browser: `/operator` -> `login?next=%2Foperator`. No signed-in operator pass. |
| 4. KB approval API | **PARTIAL** | Anonymous `GET /api/support-queue/kb-approval`: **PASS** (**403** JSON same contract; `requestId` e.g. `bee9a4a8-dca6-4a09-8a8c-7777453e90eb`). Operator `GET` list of drafts / PATCH / `POST .../approve-ingest`: **NOT RUN**. |
| 5. Escalation proxy (optional) | **NOT RUN** | Not attempted (needs configured webhooks + operator UI + signed-in context). |

**Anonymous API control probes (2026-04-10 this session, non-browser):**

- `POST https://kinetix.bookiji.com/api/ai-chat` with `{}` -> JSON `invalid_request` (handler reachable); aligns with prior post-fix probes.
- `POST https://kinetix.bookiji.com/api/support-queue/tickets` with `{}` -> **HTTP 405** JSON `method_not_allowed` (`requestId` e.g. `b0423904-5d5d-4aa5-8315-bafe38065114`; list route is **GET**-only; expected).

### Blockers (production manual gates)

1. **Support queue / KB list API routing:** **Resolved.** Anonymous `GET` to `/api/support-queue/tickets` and `/api/support-queue/kb-approval` returns JSON **403** (not SPA HTML). Re-confirmed **2026-04-10** this session.

2. **Interactive Phase 4 sign-off:** **Still blocked.** Same required **PASS** set as above. **2026-04-10 continuation:** Chrome MCP loaded Bookiji + Kinetix login URLs; **did not** establish sessions, run SQL, open Supabase dashboard, or execute operator-authenticated API/UI (see **Interactive closure session (2026-04-10 continuation)**). Prior MCP OAuth attempt also incomplete (see **Authenticated production closure attempt**).

3. **Scripted checklist gate A3 (`pnpm --filter @kinetix/web test`):** **Resolved** — Vitest aliases aligned with `monorepo-packages/*` layout; full suite green (see Automated gates table).

### Non-blocking gaps (for future runs)

- Optional escalation proxy verification when operator UI is available.

### Final Phase 4 recommendation (manual sign-off)

| Verdict | When |
|--------|------|
| **Phase 4 complete** | All checklist rows **PASS** including interactive/operator/DB/console steps. **Not met** as of **2026-04-10**. |
| **Phase 4 complete with noted issues** | Reserved for documented non-blockers; **not** used this run. |
| **Phase 4 blocked on remaining items** | **Selected.** Automated gates including **A3 Vitest** are **PASS**; Phase 4 closure remains blocked on **interactive production** rows (SSO, entitlement DB toggle, Help Center/operator authenticated flows, Supabase dashboard) until recorded **PASS** with human evidence. |

**Umbrella `PROJECT_PLAN.md`:** Do not treat Phase 4 manual closure as complete until interactive rows above are **PASS** with human-recorded evidence.

## Vitest: `@bookiji-inc/error-contract` resolver (resolved)

**Root cause:** [`apps/web/vitest.config.ts`](../apps/web/vitest.config.ts) aliased `@bookiji-inc/*` to `../../packages/<name>/src`, but Kinetix shared packages live under **`monorepo-packages/`** (see root `tsconfig.json` paths and `scripts/check-no-local-ai-core.mjs`). Vitest could not resolve `@bookiji-inc/error-contract` when loading `api/_lib/apiError.ts` and `api/_lib/ai/error-contract.ts`.

**Fix:** Point each `@bookiji-inc/*` alias at `../../monorepo-packages/<name>/src`. Production Vite build is unchanged (`vite.config.shared.ts` has only `@`; bundling uses `node_modules` + package `exports`).

| Classification | Rationale |
|----------------|-----------|
| **Gate A3** | **PASS** — `pnpm --filter @kinetix/web test` green after alias correction. |
| **Production** | Unchanged — no edits to app/API runtime code. |

## Playwright (`pnpm test:e2e` from repo root)

| Result | Notes |
|--------|--------|
| **PASS** | **18 passed** (2026-04-10); `@playwright/test` via `apps/web` `webServer` + `VITE_SKIP_AUTH=1`. |

**Spec maintenance (same session, test drift vs local Vite):** allow **`/coaching`** in [`apps/web/e2e/internal-links-crawl.spec.ts`](../apps/web/e2e/internal-links-crawl.spec.ts) allowed-path set; treat **`404`** on `POST /api/ai-chat` in [`apps/web/e2e/ai-chat-smoke.spec.ts`](../apps/web/e2e/ai-chat-smoke.spec.ts) as expected when the dev server does not mount Vercel `api/*` (production still exercises the real handler).
