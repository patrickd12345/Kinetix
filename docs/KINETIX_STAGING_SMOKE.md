# Kinetix staging smoke — operator evidence (KX-FEAT-003)

Manual and environment checks for **staging** (preview or dedicated staging hostname) **after** PR **#89** has merged into `main`. Use alongside [`docs/deployment/KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md).

**Staging rule:** Exercise **real Supabase auth** and platform profile/entitlements. **`VITE_SKIP_AUTH` must be unset/false for staging UX validation** — it is ignored in production **runtime**, but staging should mirror real sign-in behavior. **`VITE_SKIP_AUTH` must not be set during `pnpm build`** (see Production build safety below).

---

## Required staging environment variables (web / Vercel preview)

Populate from Infisical or your secret store using [`apps/web/.env.example`](../../apps/web/.env.example) as the catalog.

### Client bundle (safe to expose)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Shared Bookiji Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key (browser) |
| `VITE_AUTH_REDIRECT_URL` | OAuth/magic-link return URL for **staging hostname** if not inferring origin |
| `VITE_AUTH_*_ENABLED` | Only providers you intend to test (`GOOGLE`, `APPLE`, `MICROSOFT`) |

### Optional but common for staging

| Variable | Purpose |
|----------|---------|
| `VITE_RAG_SERVICE_URL` | RAG service for indexing / Help KB |
| `VITE_HELP_CENTER_AI_URL` | Help/support AI endpoint (often same-origin `/api/ai-chat`) |
| `VITE_APP_VERSION` | Display / escalation payload label |
| Operator/support (server-side on Vercel): `KINETIX_SUPPORT_OPERATOR_USER_IDS`, `KINETIX_APP_BASE_URL`, mail/Slack vars — see `.env.example` |

### Stripe / billing (only if staging tests checkout)

See [`docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md) and [`docs/deployment/KINETIX_STRIPE_PRODUCTION_CHECKLIST.md`](deployment/KINETIX_STRIPE_PRODUCTION_CHECKLIST.md). Use **Stripe test keys** and test price IDs on staging.

---

## Production build safety (critical for CI/staging builds)

[`scripts/check-master-access.ts`](../../scripts/check-master-access.ts) runs on web **prebuild** and **refuses** the build if any of these are truthy:

- `VITE_MASTER_ACCESS`, `VITE_SKIP_AUTH`, `ADMLOG_ENABLED`, `BOOKIJI_TEST_MODE`, etc.

So **staging preview builds** must not inject `VITE_SKIP_AUTH=1` into the **build** environment. Use dev-only bypass only on local `pnpm dev` when needed.

### Runtime behavior (already in codebase)

| Control | Behavior |
|---------|----------|
| `VITE_SKIP_AUTH` | **Ignored** when `import.meta.env.PROD === true` / production mode (`AuthProvider`) — bypass does not apply to production bundles. |
| `VITE_MASTER_ACCESS` | **Throws at module load** in production build (`apps/web/src/lib/debug/masterAccess.ts`) — must never be enabled in shipped JS. |

---

## Staging sign-in requirement

| Step | Pass criterion |
|------|----------------|
| 1 | Deploy staging with **real** `VITE_SUPABASE_*` pointing at shared dev/staging Supabase project. |
| 2 | **Do not** rely on `VITE_SKIP_AUTH` for staging smoke results. Sign in via **magic link** or **enabled OAuth** (`VITE_AUTH_*`). |
| 3 | Confirm Supabase **URL Configuration** redirect allowlist includes your **staging origin** (e.g. `https://kinetix-staging.bookiji.com/**`). |

See also: SSO + entitlement tables in [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md).

---

## Supabase requirement

| Check | Pass criterion |
|------|----------------|
| Shared project | Same Bookiji spine as documented in `.env.example`. |
| Auth providers | Providers match staging env (magic link vs OAuth). |
| Platform DB | `platform.profiles` row exists for the test user after auth. |

---

## Entitlement requirement

| Check | Pass criterion |
|------|----------------|
| Happy path | Active `platform.entitlements` row with product key **`kinetix`** for test user → app reaches Run Dashboard / shell. |
| Negative test | Removing or deactivating entitlement → **`EntitlementRequired`** (or equivalent gated UI), no silent failure. |

Align with checklist sections “SSO and entitlement” and “Entitlement gating”.

---

## Billing / Stripe (if enabled)

| Check | Pass criterion |
|------|----------------|
| Checkout | Stripe Checkout or billing link completes **in test mode** where applicable; user returns to `/billing/success` / `/billing/cancel`. |
| Errors | Failed payment or canceled checkout surfaces **visible** messaging (no silent noop). |

---

## Help / Support smoke

| Route / action | Pass criterion |
|----------------|----------------|
| `/help` | Loads; search or quick prompts eventually return answer or explicit error state. |
| Ticket path | If operator queue enabled, creating a ticket does not crash; escalation paths match [`docs/HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md). |

---

## Dashboard / History / KPS smoke

| Area | Pass criterion |
|------|----------------|
| `/` Run dashboard | Loads; coaching/today cards render or show empty/error states (no blank shell). |
| `/history` | Loads; relative **KPS** displays **≤ 100** per PB contract; expandable run detail if runs exist. |
| `/settings` | Profile/platform identity visible; imports optional. |

Automated parity: Vitest **433**, Playwright **44** on `main` after merge.

---

## Rollback

| Scenario | Action |
|---------|--------|
| Bad SPA deploy | **Promote prior** deployment in Vercel / revert git deploy commit. |
| Wrong env vars | Roll back preview env overrides; redeploy prior **successful** preview. |
| Entitlements / DB | Restore entitlement row or fix RLS separately — app is designed to **fail closed** without access. |

---

## Pass / fail checklist (staging operator)

Fill during staging run; require **PASS** before promoting to production.

| Item | Pass / Fail |
|------|-------------|
| Supabase URLs + anon key configured for staging | |
| Redirect URLs include staging origin | |
| Sign-in works **without** `VITE_SKIP_AUTH` | |
| Entitled user reaches dashboard | |
| Removing entitlement gates app | |
| `/help` responds or surfaces error clearly | |
| Dashboard + History load; KPS sensible (≤ 100 display) | |
| Billing URLs work **if** Stripe staging enabled | |
| `/api/admlog` stays disabled / 403 pattern per prod checklist **on prod only** — staging may vary; document | |

---

## Automated mainline verification (KX-FEAT-003 — local/CI reproducible)

When `main` contains merge of PR **#89** (`5d13cbf`, `9f7da01` ancestry), run from repo root:

```
pnpm install
pnpm type-check
pnpm lint
pnpm --filter @kinetix/web lint
pnpm --filter @kinetix/web test
pnpm --filter @kinetix/web build
cd apps/web && pnpm test:e2e
```

**Evidence (session):** commit `9c7ebcd…` (`main`): all commands **passed** — Vitest **433**, Playwright **44**, build succeeded.
