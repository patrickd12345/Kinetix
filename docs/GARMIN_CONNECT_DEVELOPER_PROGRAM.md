# Garmin Connect Developer Program (official path)

Kinetix uses the **supported** Garmin integration model: **OAuth 2.0 with PKCE** and partner REST APIs (Health, Activity, etc.), not consumer-site scraping.

## Why partner approval matters

Garmin issues **client_id** and **client_secret** only after **Garmin Connect Developer Program** onboarding. Without them, the OAuth and `apis.garmin.com` calls in this repo cannot succeed in production.

- [Health API overview](https://developer.garmin.com/gc-developer-program/health-api/)
- [Activity API overview](https://developer.garmin.com/gc-developer-program/activity-api/)
- [OAuth2 PKCE specification (PDF)](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf)

## Building a partnership case without unofficial libraries

Use these artifacts when applying or in follow-up reviews:

1. **Product traction** — active beta users, retention, paid intent (if applicable).
2. **Data use** — which domains are needed (e.g. activities, sleep, HRV), retention windows, and privacy posture.
3. **Technical readiness** — this repo implements the **same OAuth shape Garmin documents** (PKCE, token exchange, refresh, partner user id). Health/Activity **sync jobs** can be described as the next milestone once credentials exist.
4. **Legitimate beta data paths** — Strava link, **Garmin export ZIP / `.fit` import** (`apps/web/GARMIN_IMPORT.md`), so users are not blocked while waiting on Garmin.

## Environment variables (after approval)

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_GARMIN_CONNECT_CLIENT_ID` | Web build / client | Authorize URL (`oauth2Confirm`) |
| `VITE_GARMIN_CONNECT_REDIRECT_URI` | Optional | Fixed callback URL if it must differ from `{origin}/settings` |
| `GARMIN_CONNECT_CLIENT_SECRET` | Server only (Vercel + local `.env.local`) | Token exchange and refresh |
| `GARMIN_CONNECT_CLIENT_ID` | Server optional | Duplicate of client id if not using Vite prefix on the server |

End-to-end OAuth requires **both** the public client id (`VITE_*`) and **`GARMIN_CONNECT_CLIENT_SECRET` on the server**. The Settings UI may show **Connect** when only the Vite variable is present; token exchange fails until the secret is configured on Vercel (and in `.env.local` for dev).

Register the **redirect URI** in the Garmin developer console to match production and local dev (e.g. `https://<app>/settings`).

## Implemented in Kinetix (current)

- **Settings → Garmin Connect (partner API)** — Connect / Disconnect when `VITE_GARMIN_CONNECT_CLIENT_ID` is set.
- **POST `/api/garmin-oauth`** — Exchanges `code` + `code_verifier`; returns tokens and optional `garmin_api_user_id` from `GET .../wellness-api/rest/user/id`.
- **POST `/api/garmin-refresh`** — Refresh token rotation per Garmin docs.
- **Client** — PKCE generation (`apps/web/src/lib/garminConnectPkce.ts`), token storage in settings store, `getValidGarminConnectAccessToken()` in `apps/web/src/lib/garminConnect.ts` for future API calls.

### Token storage (current)

Access and refresh tokens are persisted in the **scoped settings blob** (same pattern as Strava/Withings credentials on web). Logout clears them via `clearSensitiveSettingsForLogout()` in `apps/web/src/store/settingsStore.ts`. For stronger production guarantees (rotation, revocation, multi-device), a follow-up could move Garmin tokens **server-side** keyed by Supabase user id.

## Next engineering steps (after keys)

The full post-approval rollout is captured in [`GARMIN_POST_APPROVAL_RUNBOOK.md`](GARMIN_POST_APPROVAL_RUNBOOK.md) as Lane C2-C7:

1. **C2 - Provision credentials** in Vercel + Infisical and register redirect URIs.
2. **C3 - Confirm endpoint base URLs** from the Garmin developer portal for each subscribed product (e.g. wellness vs activity endpoints under `apis.garmin.com`); OAuth user id uses [`wellness-api/rest/user/id`](https://developer.garmin.com/gc-developer-program/health-api/) today; Activity APIs may use different route prefixes per program docs.
3. **C4 - Server sync pipeline** (webhook + manual trigger) with checkpoints, idempotency, and rate-limit backoff.
4. **C5 - Server-side encrypted token store** keyed by Supabase user id (replaces the per-device settings blob).
5. **C6 - Tests** (Vitest integration with mocked Garmin responses + Playwright Settings flow); wired into the existing CI workflows.
6. **C7 - Re-enable Garmin in iOS** by reading from the Kinetix sync API once the server pipeline is live.

The application brief that goes to Garmin lives in [`GARMIN_CONNECT_APPLICATION_BRIEF.md`](GARMIN_CONNECT_APPLICATION_BRIEF.md).
