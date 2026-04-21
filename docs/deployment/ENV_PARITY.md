# Kinetix deployment env parity with Bookiji (SSO)

**See also:** **[`docs/platform/APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md)** (identity + secrets standard for all apps).

For local development with **Infisical** (`pnpm dev:infisical`)—secret paths, merge order, public vs server-only keys, and required variables—see **[INFISICAL_LOCAL_DEV.md](./INFISICAL_LOCAL_DEV.md)**.

`pnpm dev` is now the default Infisical-backed local command; `pnpm dev:infisical` is kept as an explicit alias.

For `kinetix.bookiji.com` to share auth with `bookiji.com`, the Kinetix deployment must use the **same** Supabase project as Bookiji.

## Required environment variables

In the Kinetix Vercel project (or wherever the web app is deployed), set:

| Variable | Value | Notes |
|----------|--------|--------|
| `VITE_SUPABASE_URL` | Same as Bookiji `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Same as Bookiji `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

Optional (identity UI): Google and Microsoft / Outlook are visible by default for BKI-019 and hidden only when the matching variable is explicitly `false` or `0`. Apple remains opt-in and is shown only when set to `true` or `1`.

| Variable | Notes |
|----------|--------|
| `VITE_AUTH_GOOGLE_ENABLED` | Show Continue with Google unless explicitly `false` or `0` |
| `VITE_AUTH_APPLE_ENABLED` | Show Continue with Apple |
| `VITE_AUTH_MICROSOFT_ENABLED` | Show Continue with Outlook unless explicitly `false` or `0` (Supabase provider `azure`) |

Optional (auth callback pinning): set when magic-link or OAuth must return to the **Kinetix** host even if the user started login from another Bookiji origin (for example `app.bookiji.com`). The web app builds `emailRedirectTo` / `redirectTo` from this value in [`apps/web/src/lib/authRedirect.ts`](../../apps/web/src/lib/authRedirect.ts). If unset, the callback uses `/login` on the **current** browser origin.

| Variable | Notes |
|----------|--------|
| `VITE_AUTH_REDIRECT_URL` | Absolute URL for the login callback, e.g. `https://kinetix.bookiji.com/login` |
| `NEXT_PUBLIC_AUTH_REDIRECT_URL` | Same as above; accepted as a fallback name |

**Production example:** `VITE_AUTH_REDIRECT_URL=https://kinetix.bookiji.com/login` (or set the origin only, e.g. `https://kinetix.bookiji.com` — the client normalizes bare origins to `/login`).

**Local dev:** If `VITE_AUTH_REDIRECT_URL` or `NEXT_PUBLIC_AUTH_REDIRECT_URL` is copied from Bookiji (for example `https://app.bookiji.com/login`), magic links would open Bookiji instead of `http://localhost:5173`. Either **omit** those variables in `apps/web/.env.local`, or set them to `http://localhost:5173/login`. The client also **ignores a non-localhost pin when `import.meta.env.DEV` is true and the app runs on `localhost` or `127.0.0.1`** ([`apps/web/src/lib/authRedirect.ts`](../../apps/web/src/lib/authRedirect.ts)), so shared Infisical values do not break local magic links.

The Kinetix web client ([`apps/web/src/lib/supabaseClient.ts`](../../apps/web/src/lib/supabaseClient.ts)) reads `VITE_*` first and falls back to `NEXT_PUBLIC_*`. For Vite builds, set the `VITE_*` pair; you can also set `NEXT_PUBLIC_*` to the same values so both names work.

Optional (Withings **expanded** sync — activity/sleep ingestion + scheduled HH:MM slots in Settings): in **production** builds this is off unless enabled. **`pnpm dev`** defaults it **on** so the toggles and Sync now control work without env. To turn it off locally, set `VITE_ENABLE_WITHINGS_EXPANDED_INGESTION=false` in `apps/web/.env.local`. To turn it **on** on Vercel, set `VITE_ENABLE_WITHINGS_EXPANDED_INGESTION=true`. See [`apps/web/src/lib/featureFlags.ts`](../../apps/web/src/lib/featureFlags.ts).

**Session persistence:** The Supabase client uses `persistSession: true` and `autoRefreshToken: true`, so a successful sign-in is kept in the browser (per-origin storage, typically `localStorage`) and refreshed automatically. New magic links are only needed after sign-out, session expiry, or cleared site data. **Origins are isolated:** `http://localhost:5173` and `http://127.0.0.1:4173` are different sites for storage—use one consistent dev URL. Incognito/private windows drop storage when closed.

## BKI-036 Withings and app-origin env migration

**Status:** completed for Kinetix Production on 2026-04-20.

The Infisical Vercel Secret Sync **`kinetix-prod-kinetix-to-vercel-production`** is configured and enabled:

- source: Infisical `prod` `/kinetix`
- destination: Vercel project `kinetix`, environment `production`
- auto-sync: enabled
- destination deletion: disabled, so unrelated/manual Vercel vars are not removed by this sync

Kinetix stores product-specific Withings OAuth and app-origin values in Infisical **`/kinetix`**. Shared Supabase values remain in **`/platform`**.

| Variable | Target Infisical path | Vercel Production status | Notes |
|----------|------------------------|--------------------------|-------|
| `WITHINGS_CLIENT_ID` | `/kinetix` | Synced | Server-side Withings client id alias |
| `VITE_WITHINGS_CLIENT_ID` | `/kinetix` | Synced | Browser authorize client id |
| `WITHINGS_CLIENT_SECRET` | `/kinetix` | Synced | Server-only token exchange and refresh secret |
| `WITHINGS_REDIRECT_URI` | `/kinetix` | Synced | Production value must be `https://kinetix.bookiji.com/api/withings-oauth` |
| `VITE_WITHINGS_REDIRECT_URI` | `/kinetix` | Synced | Production value must be `https://kinetix.bookiji.com/api/withings-oauth` |
| `KINETIX_APP_BASE_URL` | `/kinetix` | Synced | Production value must be `https://kinetix.bookiji.com` |

Do not copy local `.env.local` wholesale into Infisical or Vercel. The old local file contained unrelated dev/admin/personal keys such as `ADMLOG_ENABLED`, `ADMLOG_PASSWORD`, and `WITHINGS_REFRESH_TOKEN`; those are not durable Kinetix production configuration.

For local development, use `pnpm dev`. It loads Infisical `dev` from `/platform` and `/kinetix`, then starts the raw RAG + web dev servers. `pnpm dev:raw` is the explicit non-Infisical fallback only.

Preview/Development Vercel values should be handled deliberately. Infisical `dev` currently carries localhost callback/base URL values for local development, so do not blindly sync those into Vercel Preview unless the preview callback/base URL policy has been decided.

**Proof performed:** `BKI_036_SYNC_PROOF` was created only in Infisical `prod /kinetix`, appeared in Vercel Production through the Secret Sync, and was then removed from both systems. No secret values were printed.

## Admlog (`GET /api/admlog`)

Admin one-shot login is implemented in [`api/admlog/index.ts`](../../api/admlog/index.ts) using `@bookiji-inc/platform-auth`. **Production safety:** `isAdmlogEnabled()` is false when `NODE_ENV` or `VERCEL_ENV` is `production`, so the route cannot issue a session on Vercel Production even if secrets were wrong.

**Operator rules:**

- Do **not** set `ADMLOG_ENABLED=true` (or `BOOKIJI_TEST_MODE=true` for admlog) in **Infisical `prod`** or Vercel Production env. `node scripts/verify-infisical.mjs --env=prod` fails only if **`ADMLOG_ENABLED` is true in Infisical `/platform` or `/kinetix` prod** (local `apps/web/.env.local` and shell env are not used for that check, and `.env.local` is not merged for prod verify).
- Use Preview / local dev with explicit flags when you need admlog; expect the JSON 403 body to state clearly when the deployment is production.

**How to use admlog (non-production only):**

- Open `GET /api/admlog` in the **browser** (same tab you use for the app). The handler returns a short HTML page that writes the Supabase session into **browser `localStorage`** (what the Vite app uses) and then navigates to the app. Cookie-only sessions do not work with `@supabase/supabase-js` in the SPA, so this HTML bridge is required.
- Optional path: `GET /api/admlog?next=/` or `?next=/operator` or `?next=/history` (use `/history` when validating Run History with the `admlog@bookiji.test` session). Invalid values fall back to `/operator`.
- On success, the handler upserts an active **`kinetix`** row in `platform.entitlements` for `admlog@bookiji.test` (via `ensureEntitlementProductKeys` in `@bookiji-inc/platform-auth`) so the app passes entitlement gating without a separate seed step.
- **Local dev (`pnpm dev` / port 5173):** Vite registers `/api/admlog` in [`apps/web/vite-plugin-oauth.ts`](../../apps/web/vite-plugin-oauth.ts) so the route is not swallowed by the SPA. Restart the dev server after changing env.
- **Required server env in `apps/web/.env.local` (not `VITE_*` — never commit):**
  - `ADMLOG_ENABLED=true` (or `BOOKIJI_TEST_MODE=true` for the default local admlog password path in platform-auth).
  - `ADMLOG_PASSWORD` — dev password used for the synthetic `admlog@bookiji.test` user (required when admlog flags are set).
  - **`SUPABASE_SECRET_KEY`** — **recommended:** next-gen secret key `sb_secret_...` from Supabase Dashboard → **Project Settings → API Keys** (admlog uses Auth Admin APIs; this works when **JWT legacy API keys are disabled**).
  - **`SUPABASE_SERVICE_ROLE_KEY`** — legacy **service_role** JWT (Legacy API Keys tab). Only use if the project still allows legacy keys; otherwise Auth returns errors such as `Legacy API keys are disabled`.

If `/api/admlog` returns **500** with text about missing elevated key, either:

- Add **`SUPABASE_SECRET_KEY`** manually (Dashboard → **API Keys** → secret key `sb_secret_...`), or
- Run **`pnpm sync:admlog-service-role`** from the repo root (uses `SUPABASE_ACCESS_TOKEN` + `VITE_SUPABASE_URL` in `apps/web/.env.local` to call the Supabase Management API and append **`SUPABASE_SECRET_KEY`** when available — **never commit** `.env.local`).

Then restart `pnpm dev`.

## Where to get values

From the Bookiji Supabase project:

- **Dashboard** → Project Settings → API: use **Project URL** and **anon public** key.
- Or copy from Bookiji’s deployment env (e.g. Vercel) for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Local development

For login to work when running the app locally (`pnpm dev:web` or similar):

1. Use the same values in `apps/web/.env.local`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same as production).
2. In the Bookiji Supabase project: **Authentication** → **URL Configuration** → **Redirect URLs**, add `http://localhost:5173` and `http://localhost:5173/**` (or your dev server port). Otherwise Supabase will not redirect back to localhost after sign-in.
3. In the Bookiji Supabase project: **Authentication** → **Providers**
   - enable Email magic link / OTP
   - disable email/password sign-in and password reset/recovery flows
   - enable Google/Apple/Microsoft only when the provider credentials are configured

### Parked auth issue (local testing note)

- Current local blocker: repeated magic-link OTP requests can hit Supabase throttle (`Too many sign-in attempts... wait a minute`).
- Supabase-managed SMTP currently blocks changing `rate_limit_email_sent` through Management API unless custom SMTP is configured.
- Continue local testing through `GET /api/admlog?next=/...` (no auth bypass flag required).

## Identity standard in Kinetix web

Kinetix web follows the Bookiji identity standard:

- primary login: email magic link (passwordless)
- optional login: Google and Outlook by default; Apple only when enabled in app env
- unsupported: password login, password reset, username/password signup

## If these differ

If Kinetix points at a different Supabase project or keys, SSO will break: sessions and `platform.profiles` / entitlements live in the Bookiji project.

## Vercel project and Infisical sync

The production Kinetix web app is deployed on Vercel under the team project named **`kinetix`** (Vercel project id `prj_PqH4JVkBw7ShlOz4yOS91bK6bmmI`, team `patrick-duchesneaus-projects`). Environment variables are not committed; they must match Bookiji’s shared Supabase project for the same runtime tier.

| Vercel target | Infisical env | Required vars (minimum) |
|---------------|---------------|--------------------------------|
| Preview | `dev` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or publishable key under one of the names in [`INFISICAL_LOCAL_DEV.md`](./INFISICAL_LOCAL_DEV.md)) |
| Production | `prod` | Same Supabase pair from `/platform`, plus the BKI-036 Withings/app-origin keys from `/kinetix` |

**Ways to keep parity:**

1. **Infisical Vercel Secret Sync** — Kinetix Production is wired via `kinetix-prod-kinetix-to-vercel-production`, mapping Infisical `prod` `/kinetix` to Vercel Production. Add separate syncs only after choosing correct non-localhost values for Preview/Development.
2. **Manual** — copy `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Bookiji Vercel project’s matching environment, or from Infisical export, into the `kinetix` project.

**Smoke check (local, no secrets printed):** from [`products/Kinetix`](../../) run `pnpm verify:infisical` (validates merged `/platform` + `/kinetix` for `dev`) and `node scripts/verify-infisical.mjs --env=prod` for production Infisical.

## Entitlement testing (no Stripe in Kinetix web)

Access is gated by `platform.entitlements` with `product_key = 'kinetix'`. To grant access for QA without a card flow, use [`apps/web/scripts/seed-kinetix-entitlement-admin.ts`](../../apps/web/scripts/seed-kinetix-entitlement-admin.ts) with server credentials, or insert via Supabase with migrations for durable changes. See [`STRIPE_KINETIX_ENTITLEMENTS.md`](./STRIPE_KINETIX_ENTITLEMENTS.md) for future Stripe-to-entitlement design.
