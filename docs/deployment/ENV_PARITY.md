# Kinetix deployment env parity with Bookiji (SSO)

For local development with **Infisical** (`pnpm dev:infisical`)—secret paths, merge order, public vs server-only keys, and required variables—see **[INFISICAL_LOCAL_DEV.md](./INFISICAL_LOCAL_DEV.md)**.

For `kinetix.bookiji.com` to share auth with `bookiji.com`, the Kinetix deployment must use the **same** Supabase project as Bookiji.

## Required environment variables

In the Kinetix Vercel project (or wherever the web app is deployed), set:

| Variable | Value | Notes |
|----------|--------|--------|
| `VITE_SUPABASE_URL` | Same as Bookiji `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Same as Bookiji `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

The Kinetix web client ([`apps/web/src/lib/supabaseClient.ts`](../../apps/web/src/lib/supabaseClient.ts)) reads `VITE_*` first and falls back to `NEXT_PUBLIC_*`. For Vite builds, set the `VITE_*` pair; you can also set `NEXT_PUBLIC_*` to the same values so both names work.

## Where to get values

From the Bookiji Supabase project:

- **Dashboard** → Project Settings → API: use **Project URL** and **anon public** key.
- Or copy from Bookiji’s deployment env (e.g. Vercel) for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Local development

For login to work when running the app locally (`pnpm dev:web` or similar):

1. Use the same values in `apps/web/.env.local`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same as production).
2. In the Bookiji Supabase project: **Authentication** → **URL Configuration** → **Redirect URLs**, add `http://localhost:5173` and `http://localhost:5173/**` (or your dev server port). Otherwise Supabase will not redirect back to localhost after sign-in.

## If these differ

If Kinetix points at a different Supabase project or keys, SSO will break: sessions and `platform.profiles` / entitlements live in the Bookiji project.
