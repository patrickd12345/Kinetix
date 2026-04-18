# Kinetix release candidate (RC) — KX-FEAT-002

**Feature:** KX-FEAT-002 — Final closure / release candidate pass
**Scope:** Kinetix **web** app (`apps/web`, `@kinetix/web`). Native iOS/watchOS is **out of scope** for automated verification in this environment; manual runbooks apply.

**RC inspection date:** 2026-04-18 (UTC, agent run)

## Release candidate status: **APPROVED (web) — ready for `kinetix-rc-2` tag after merge**

The web application passes the full automated gate defined below. **This does not certify native apps**; tag as **web / full-stack** RC only in line with your release policy (see “Native verification”).

---

## Commit and branch inspected

| Item | Value |
|------|--------|
| **Branch** | `cursor/kinetix-readiness-8210` (includes KX-FEAT-001 / PR #89) |
| **HEAD commit** | `5d13cbfd99740ae3f2c7909ddf2497e52343f5b8` |
| **Short message** | `readiness: cap KPS display at 100, gate skip-auth in prod, document audit` |
| **Working tree** | Clean (no uncommitted changes at verification time) |
| **Merge path** | Merge **PR #89** to `main` (or equivalent) before tagging production artifacts |

> **KX-FEAT-001 presence:** Confirmed — `kpsDisplayPolicy.ts`, readiness doc, `AuthProvider` production gate for `VITE_SKIP_AUTH`, and related KPS/settings/e2e changes are on this branch at the commit above.

---

## Checks run (this pass) — all **PASS**

Executed from repository root (`/workspace`) on 2026-04-18.

| # | Command | Result |
|---|---------|--------|
| 1 | `pnpm install` | **Pass** |
| 2 | `pnpm type-check` | **Pass** |
| 3 | `pnpm lint` | **Pass** |
| 4 | `pnpm --filter @kinetix/web lint` | **Pass** |
| 5 | `pnpm --filter @kinetix/web test` | **Pass** — 99 test files, **433** tests |
| 6 | `pnpm --filter @kinetix/web build` | **Pass** (Vite + bundle budget) |
| 7 | `cd apps/web && pnpm test:e2e` | **Pass** — **44** tests (chromium) |

**Match to KX-FEAT-001 baselines:** Same pass/fail surface as the readiness run (433 + 44); re-run in this pass confirms no drift.

---

## User-facing route coverage (web)

E2E and integration tests cover the shell with **VITE_SKIP_AUTH=1** in the Playwright webServer profile (dev gate). Core routes and smoke:

| Area | Route(s) | Evidence |
|------|-----------|--------|
| Auth entry | `/login` | `kinetix-audit-crawl`, `internal-links-crawl` |
| Dashboard (KPS surface) | `/` | `shell-dashboard`, `kinetix-audit-crawl`, run modals e2e |
| History + run expand/detail | `/history` | `heavy-user-fixture`, `History.integration` |
| Coaching / suggested | `/coaching` | `heavy-user-fixture`, `kinetix-audit-crawl`, `Coaching.test` |
| Charts hub | `/menu` | `charts` e2e, internal link crawl |
| Settings | `/settings` | `settings-interactions` e2e |
| Help / support | `/help` | `help-center-a11y`, `help-support-search-flow` |
| Chat (AI) | `/chat` | `ai-chat-smoke` e2e |
| Billing / return | `/billing/success`, `/billing/cancel` | `kinetix-audit-crawl`, `billing-return-routes.integration` |
| Entitlement gate (integration) | — | `auth-entitlement.integration.test` |
| Operator / queue | `/operator`, `/support-queue` | `operator-support-queue-smoke`, audit crawl |
| Weight | `/weight-history` | audit crawl, internal links |

**Pass/fail (automated):** All **pass** in this run.

**Manual staging note:** E2E uses skip-auth; production should be smoke-tested with real Supabase + entitlements (see “Next step” below).

---

## Production safety audit (re-check) — no critical blockers

| Check | Status | Notes |
|-------|--------|--------|
| **Production auth bypass** | **OK** | `VITE_SKIP_AUTH` is **not** active when `import.meta.env.PROD` / `MODE === 'production'` — see `AuthProvider`. |
| **Master access in production** | **OK** | `masterAccess.ts` throws if `VITE_MASTER_ACCESS` set in prod build; `MASTER_ACCESS` is false in production. |
| **Hardcoded secrets in client** | **OK** | No `sk_`, `re_` API key patterns in `src` (spot audit); secrets belong in env / server. |
| **Service role / private keys in browser bundle** | **OK** (spot) | Supabase **anon** key is expected client-side; document publishable key migration in `.env.example`. |
| **Dev mocks in production** | **OK** | Skip-auth and master access are dev/audit-gated. |
| **Test-only API routes in prod** | **OK** (convention) | Vite builds the SPA; API behavior is Vercel/serverless — use staging checklist for real routing. |
| **Sensitive `console` logging** | **Low risk** | Strava paths log **warnings** for refresh errors (message only). No `console` of full tokens found in quick grep. **Post-RC:** consider gating `console` under `import.meta.env.DEV` only. |
| **Webhook / escalation** | **OK (tests)** | Tests cover missing webhook, rate limit, 204 on disable — see `escalation-notify-route.test`. |
| **Env documentation** | **OK** | `apps/web/.env.example` and deployment docs. |

**Critical blockers for RC (web / CI):** **None** identified in this pass.

---

## Production / staging environment requirements (web)

Minimum for a **real** (non-skip-auth) deploy:

- **Supabase (client):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_*` per `.env.example`).
- **Optional OAuth:** `VITE_AUTH_GOOGLE_ENABLED`, etc.
- **Entitlements:** Platform `entitlements` table + RLS aligned; product key `kinetix` — or users see `EntitlementRequired` (fail closed by design when schema/keys mismatch per `platformAuth`).

See also: `docs/deployment/ENV_PARITY.md`, `docs/deployment/KINETIX_STRIPE_PRODUCTION_CHECKLIST.md` for billing.

---

## Known limitations (not RC blockers)

- **RAG / Help AI:** Degrades if RAG or AI URL unset; RAG sync banner in shell when repeated failures.
- **Very large local DBs:** Some History filter paths can load all runs client-side; documented in readiness doc.
- **Native apps:** No Xcode / simulator / device in CI sandbox; **not** part of this RC gate.
- **Operator/support routes** in production require correct operator allow-lists and API auth (E2E uses skip-auth and mocks).

---

## Native / iOS / watchOS verification

| What | Status in this pass |
|------|---------------------|
| Automated CI | **Not run** (no iOS `package.json`; Xcode project under `ios/`, `watchos/`). |
| Safe static review | **Not executed** in this pass (out of time scope). |
| Manual / device | **Required** for “full Kinetix” product RC if Watch/iPhone are in support matrix — use `docs/audit/KINETIX_NATIVE_AUDIT_RUNBOOK.md` and `watchos/KinetixWatch/TESTING.md` (Self-Test, UI Audit on device/simulator). |

**Cannot run in this sandbox:** Apple Watch, iPhone, full HealthKit, Watch Connectivity, App Store build/signing.

---

## Deployment notes (web)

- **Build output:** `apps/web/dist` (see `vercel.json` and `README.md`).
- **Node:** 22.x per root `package.json` engines; `pnpm@10.30.3` lock.
- **Prebuild:** `check-master-access.ts` runs on web `build` to prevent `VITE_MASTER_ACCESS` in production.
- **Post-merge:** Run the same pnpm check suite on `main` in CI; deploy **preview** then **production**; verify `EntitlementRequired` and login on staging URL.

## Rollback notes (web)

- Revert the deployment to the **previous** Vercel / hosting deployment (promotion rollback).
- If bad data or flags: ensure production env does not set `VITE_SKIP_AUTH` or `VITE_MASTER_ACCESS` (latter is ignored at build if not present; **do not** set in prod).
- Database/Stripe: use platform rollback procedures; not triggered by this SPA release alone if only static assets change.

---

## Optional git tag (not created in repo by this pass)

| Recommendation | `kinetix-rc-2` |
|----------------|----------------|
| **When to apply** | After **PR #89** merges to `main` (or the chosen release line), and **the same** checks pass on `main` in CI. |
| **If native is in scope** | Add a runbook sign-off in `REPO_STATUS.md` or a release issue before production promotion. |

---

## Final recommendation

**ready for RC tag (web) — `kinetix-rc-2` (after merge + CI re-run on `main`)**

- **Not** “full product including Watch/iPhone” without native verification.
- **Next step (mandatory for production):** Staging deploy with real Supabase + entitlements, smoke login, one paid/entitled test user, billing return URLs — follow `docs/deployment/KINETIX_VERIFICATION_CHECKLIST.md`.

**Cross-reference:** See `docs/KINETIX_FULL_FLEDGED_READINESS.md` (KX-FEAT-001) for detailed route table and KPS contract notes; that doc is updated for KX-FEAT-002 final verification status.
