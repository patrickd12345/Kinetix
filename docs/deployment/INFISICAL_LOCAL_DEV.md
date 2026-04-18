# Infisical local development

**See also:** workspace **[`docs/platform/APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md)**, Kinetix **[`docs/deployment/README.md`](./README.md)**, and KX-FEAT-004 policy **[`INFISICAL_CANONICAL_SECRETS.md`](./INFISICAL_CANONICAL_SECRETS.md)**.

## Purpose

Use Infisical as the **local source of truth** for shared platform secrets and Kinetix-specific secrets without baking secrets into the repo or asking the browser runtime to talk to Infisical directly.

The local flow is intentionally narrow:

- pull from **`/platform`** and **`/kinetix`**
- merge locally for developer startup and validation
- fail fast when required variables are missing
- never print secret values

## Prerequisites

1. Install the **Infisical CLI** and make sure `infisical` is on `PATH`.
2. Log in before using Kinetix Infisical commands:

```bash
infisical login
```

3. Make sure the CLI can resolve the correct project via either:
   - `INFISICAL_PROJECT_ID`, or
   - `.infisical.json` with `workspaceId`

If the CLI is missing or login/project resolution is broken, `pnpm dev:infisical` and `pnpm verify:infisical` should fail before any normal dev server logic starts.

## Expected paths

Kinetix local merge expects these Infisical paths:

| Path | Purpose | Notes |
|------|---------|-------|
| **`/platform`** | Shared Bookiji infrastructure secrets | Shared Supabase URL, anon/publishable keys, platform tokens, and other server-side shared values. |
| **`/kinetix`** | Kinetix-only secrets | Product-specific OAuth, AI, billing, and integration secrets. |

Merge order is:

```text
process.env <- /platform <- /kinetix <- apps/web/.env.local
```

That means Kinetix-specific keys override shared platform keys, and local emergency overrides win last.

## Local commands

### Start local development with Infisical

```bash
pnpm dev:infisical
```

This runs [`scripts/dev-with-infisical.mjs`](../../scripts/dev-with-infisical.mjs), which:

1. resolves the Infisical project
2. exports **`/platform`** and **`/kinetix`**
3. applies the local merge
4. applies the `SUPABASE_SECRET_KEY -> SUPABASE_SERVICE_ROLE_KEY` compatibility alias when needed
5. validates required client envs before spawning `pnpm dev`

### Validate secrets without starting the app

```bash
pnpm verify:infisical
```

Optional alternate environment:

```bash
node scripts/verify-infisical.mjs --env=prod
```

Success means the merge completed and the required Supabase URL plus publishable/anon key resolved. Output may include key counts and validation status, but **must never include secret values**.

## Required variables for a working local web client

After merge and aliasing, the following must resolve exactly as the web client expects in [`apps/web/src/lib/supabaseClient.ts`](../../apps/web/src/lib/supabaseClient.ts):

1. **Supabase URL**
   - `VITE_SUPABASE_URL`, or
   - `NEXT_PUBLIC_SUPABASE_URL`
2. **Supabase publishable / anon key**
   - `VITE_SUPABASE_ANON_KEY`, or
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

If any required variable is missing, the Infisical helper should fail closed before normal startup.

## Public vs server-only values

Anything prefixed with **`VITE_`** or **`NEXT_PUBLIC_`** is treated as public by the web build and must be safe to ship to browsers.

Keep secrets like these server-only:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SERVICE_KEY`
- `STRAVA_CLIENT_SECRET`
- `WITHINGS_CLIENT_SECRET`
- `GEMINI_API_KEY`

## `.env.local` emergency fallback

If Infisical is temporarily unavailable, a developer may place the minimum required values in:

```text
apps/web/.env.local
```

This is an **emergency local fallback only** for unblocking development. Rules:

- do not commit `.env.local`
- do not treat `.env.local` as the canonical source of truth
- move any durable value back into Infisical once access is restored
- prefer the smallest possible local override rather than copying a full environment dump

## Troubleshooting

### `infisical: command not found`

Install the Infisical CLI and retry.

### CLI is installed but export fails

Most common causes:

- not logged in (`infisical login`)
- wrong `INFISICAL_PROJECT_ID`
- stale or missing `.infisical.json`
- missing access to **`/platform`** or **`/kinetix`**

### Validation fails after merge

Run:

```bash
pnpm verify:infisical
```

Then fix the missing variable in the correct place:

- shared value -> **`/platform`**
- Kinetix-only value -> **`/kinetix`**
- temporary local unblock -> `apps/web/.env.local`

### Local auth redirects back to the wrong host

Check [`ENV_PARITY.md`](./ENV_PARITY.md) and make sure local callback settings are compatible with localhost. Shared production redirect pins must not break local testing.

## No-secret-logging rule

Kinetix Infisical tooling may log:

- which paths were read
- which environment was requested
- counts of keys found
- names of missing variables

Kinetix Infisical tooling must **not** log:

- secret values
- partially masked secret values that still reveal useful entropy
- raw exported JSON payloads
- copied `.env` file contents

## Production and runtime non-goals

This local-dev flow does **not** mean:

- the browser may call Infisical at runtime
- production deploys should fetch secrets from the browser
- normal build, lint, or test commands should require live Infisical credentials
- Kinetix should bypass deployment-time validation when required env vars are missing

Local Infisical is for **developer startup and verification** only. Production and CI secret delivery are handled by deployment-time sync and runtime-safe environment injection, not browser access.
