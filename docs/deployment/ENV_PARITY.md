# Kinetix deployment env parity with Bookiji (SSO)

**See also:** **[`docs/platform/APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md)** (identity + secrets standard for all apps).

For local development with **Infisical** (`pnpm dev:infisical`)—secret paths, merge order, public vs server-only keys, and required variables—see **[INFISICAL_LOCAL_DEV.md](./INFISICAL_LOCAL_DEV.md)**.

For `kinetix.bookiji.com` to share auth with `bookiji.com`, the Kinetix deployment must use the **same** Supabase project as Bookiji.

## Required environment variables

In the Kinetix Vercel project (or wherever the web app is deployed), set:

| Variable | Value | Notes |
|----------|--------|--------|
| `VITE_SUPABASE_URL` | Same as Bookiji `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Same as Bookiji `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

Optional (identity UI): set to `true` or `1` to show the matching OAuth button on the login screen. If unset or false, that provider is hidden.

| Variable | Notes |
|----------|--------|
| `VITE_AUTH_GOOGLE_ENABLED` | Show Continue with Google |
| `VITE_AUTH_APPLE_ENABLED` | Show Continue with Apple |
| `VITE_AUTH_MICROSOFT_ENABLED` | Show Continue with Microsoft (Supabase provider `azure`) |

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

## Admlog (`GET /api/admlog`)

Admin one-shot login is implemented in [`api/admlog/index.ts`](../../api/admlog/index.ts) using `@bookiji-inc/platform-auth`. **Production safety:** `isAdmlogEnabled()` is false when `NODE_ENV` or `VERCEL_ENV` is `production`, so the route cannot issue a session on Vercel Production even if secrets were wrong.

**Operator rules:**

- Do **not** set `ADMLOG_ENABLED=true` (or `BOOKIJI_TEST_MODE=true` for admlog) in **Infisical `prod`** or Vercel Production env. `pnpm verify:infisical` with `--env=prod` fails if `ADMLOG_ENABLED` is true in merged prod secrets.
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

## Identity standard in Kinetix web

Kinetix web follows the Bookiji identity standard:

- primary login: email magic link (passwordless)
- optional login: Google, Apple, Microsoft (only shown when enabled in app env)
- unsupported: password login, password reset, username/password signup

## If these differ

If Kinetix points at a different Supabase project or keys, SSO will break: sessions and `platform.profiles` / entitlements live in the Bookiji project.

## Vercel project and Infisical sync

The production Kinetix web app is deployed on Vercel under the team project named **`kinetix`** (Vercel project id `prj_PqH4JVkBw7ShlOz4yOS91bK6bmmI`, team `patrick-duchesneaus-projects`). Environment variables are not committed; they must match Bookiji’s shared Supabase project for the same runtime tier.

| Vercel target | Infisical env | Required client vars (minimum) |
|---------------|---------------|--------------------------------|
| Preview | `dev` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or publishable key under one of the names in [`INFISICAL_LOCAL_DEV.md`](./INFISICAL_LOCAL_DEV.md)) |
| Production | `prod` | Same pair, using **production** Supabase URL and publishable/anon key from Infisical `prod` `/platform` |

**Ways to keep parity:**

1. **Infisical Vercel integration** — map Infisical `dev` to Vercel Preview and Infisical `prod` to Vercel Production (see [`ops/env/infisical-architecture.md`](../../../../ops/env/infisical-architecture.md)).
2. **Manual** — copy `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Bookiji Vercel project’s matching environment, or from Infisical export, into the `kinetix` project.

**Smoke check (local, no secrets printed):** from [`products/Kinetix`](../../) run `pnpm verify:infisical` (validates merged `/platform` + `/kinetix` for `dev`) and `node scripts/verify-infisical.mjs --env=prod` for production Infisical.

## Entitlement testing (no Stripe in Kinetix web)

Access is gated by `platform.entitlements` with `product_key = 'kinetix'`. To grant access for QA without a card flow, use [`apps/web/scripts/seed-kinetix-entitlement-admin.ts`](../../apps/web/scripts/seed-kinetix-entitlement-admin.ts) with server credentials, or insert via Supabase with migrations for durable changes. See [`STRIPE_KINETIX_ENTITLEMENTS.md`](./STRIPE_KINETIX_ENTITLEMENTS.md) for future Stripe-to-entitlement design.
