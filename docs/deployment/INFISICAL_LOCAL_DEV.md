# Infisical local development

The root script `pnpm dev:infisical` runs [`scripts/dev-with-infisical.mjs`](../../scripts/dev-with-infisical.mjs) to load secrets before `pnpm dev` (web + RAG).

## Flow

1. Resolve Infisical project: `INFISICAL_PROJECT_ID` or `.infisical.json` → `workspaceId`.
2. Export JSON secrets for paths **`/platform`** and **`/kinetix`**, environment **`INFISICAL_ENV`** (default `dev`).
3. Merge: `process.env` ← `/platform` ← `/kinetix` (later paths override earlier).
4. Apply **temporary compatibility alias**: if `SUPABASE_SECRET_KEY` is set and neither `SUPABASE_SERVICE_ROLE_KEY` nor `SUPABASE_SERVICE_KEY` is set, set `SUPABASE_SERVICE_ROLE_KEY` from `SUPABASE_SECRET_KEY` (Bookiji `/platform` naming).
5. **Validate** required variables (fail-fast with explicit names). If valid, spawn `pnpm dev`.

SSO and Supabase client setup for production parity: see [`ENV_PARITY.md`](./ENV_PARITY.md).

## Secret path ownership

| Path | Owns | Notes |
|------|------|--------|
| **`/platform`** | Shared Bookiji infrastructure | Same Supabase project and platform guardrails as other Bookiji apps. Use for URLs, publishable keys, `SUPABASE_ACCESS_TOKEN`, `SHARED_DB_*`, and **`SUPABASE_SECRET_KEY`** (service role; server-side only). |
| **`/kinetix`** | Kinetix-only secrets | App-specific keys (e.g. Strava, Withings, Gemini, OAuth client secrets) that are not shared platform-wide. Empty is allowed if everything lives under `/platform` or local `.env.local`. |

Merge order means **`/kinetix` overrides `/platform`** on key collisions.

## Public vs server-only (web bundle)

Vite exposes env to the client when the key is prefixed with **`VITE_`** or **`NEXT_PUBLIC_`** (`envPrefix` in `apps/web/vite.config.ts`). Treat these as **public** (they ship in the browser bundle).

| Prefix | Typical use |
|--------|-------------|
| `VITE_*` | Preferred for Kinetix web (Supabase URL, anon/publishable key, feature flags safe for clients). |
| `NEXT_PUBLIC_*` | Compatibility with Bookiji / Next naming; same exposure rules as `VITE_*` in this repo. |

**Server-only** (do not rely on “hiding” in the client; keep out of `VITE_` / `NEXT_PUBLIC_` unless the value is designed to be public):

- `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`
- `STRAVA_CLIENT_SECRET`, `WITHINGS_CLIENT_SECRET`, `GEMINI_API_KEY`, etc.

## Temporary alias (compatibility only)

**`SUPABASE_SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY`**

Bookiji’s `/platform` folder often stores the service role as `SUPABASE_SECRET_KEY`. Kinetix scripts and APIs may expect `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`. The dev script copies across **only when** the legacy role key names are unset, so explicit `SUPABASE_SERVICE_ROLE_KEY` in Infisical or `.env` always wins.

## Required variables for `dev:infisical`

After merge and aliasing, the following **must** be satisfied (same resolution as [`apps/web/src/lib/supabaseClient.ts`](../../apps/web/src/lib/supabaseClient.ts)):

1. **Supabase URL** — at least one non-empty value among: `VITE_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`
2. **Supabase publishable / anon key** — at least one non-empty value among: `VITE_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

If validation fails, the process exits before starting `pnpm dev`, and the error lists what is missing.

## Verification without starting the dev server

Shared merge logic lives in [`scripts/infisical-merge-lib.mjs`](../../scripts/infisical-merge-lib.mjs). Run:

```bash
pnpm verify:infisical
```

Optional Infisical environment (default `dev`):

```bash
node scripts/verify-infisical.mjs --env=prod
```

On success, the script prints key counts and whether the Supabase URL resolved (no secret values). Exit code `0` means `/platform` plus `/kinetix` merged and the Supabase URL plus publishable/anon key checks passed.

## Alternatives

- **`pnpm dev`** without Infisical: set the same variables in `apps/web/.env.local` (see `apps/web/.env.example`).
