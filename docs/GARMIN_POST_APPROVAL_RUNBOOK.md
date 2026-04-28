# Garmin Connect post-approval runbook (Lane C2-C7)

Triggered the moment Garmin issues a `client_id` and `client_secret` for the **Garmin Connect Developer Program**. Until then, work in this runbook is parked.

> Pre-condition: [`GARMIN_CONNECT_APPLICATION_BRIEF.md`](GARMIN_CONNECT_APPLICATION_BRIEF.md) has been submitted, the receipt id is recorded in [`PROJECT_PLAN.md`](PROJECT_PLAN.md), and Garmin has emailed back with credentials.

## C2 - Provision credentials (1 hour)

1. **Vercel (kinetix project, Production):**
   - Add `GARMIN_CONNECT_CLIENT_ID` (server)
   - Add `GARMIN_CONNECT_CLIENT_SECRET` (server, encrypted)
   - Add `VITE_GARMIN_CONNECT_CLIENT_ID` = same client id (public; needed at build time for the authorize URL).
2. **Infisical:** mirror the three vars at `/platform` (env=prod). Add to `dev` env with **separate** dev credentials when Garmin issues them.
3. **Garmin developer portal:** register redirect URIs:
   - `https://kinetix.bookiji.com/settings`
   - `http://localhost:3000/settings` (dev)
4. **Vercel preview deploy:** deploy a feature branch with the env set; verify the Settings page shows "Connect Garmin Connect" (instead of the disabled state).

## C3 - Confirm endpoint base URLs (1-2 hours)

The repo currently calls `apis.garmin.com/wellness-api/rest/user/id`. Activity API may use a different base.

1. Open the Garmin developer portal docs for the **specific products** subscribed (Health, Activity).
2. For each domain, capture:
   - Base URL (`apis.garmin.com/...`)
   - User-id endpoint
   - Sync endpoint(s)
   - Webhook endpoint shape (if push-based)
3. Update [`api/_lib/garminOAuth.ts`](../api/_lib/garminOAuth.ts) `GARMIN_USER_ID_URL` if it differs per product. Add per-domain helpers for activities vs wellness.
4. Update [`docs/GARMIN_CONNECT_DEVELOPER_PROGRAM.md`](GARMIN_CONNECT_DEVELOPER_PROGRAM.md) "Next engineering steps" with the confirmed base URLs.

## C4 - Server sync pipeline (5-10 days, lead engineer)

Two patterns; Garmin documents both.

### Option A - Webhook (push)

1. Add `POST /api/garmin-webhook` Vercel function that verifies Garmin signature.
2. On payload, write a row to a `kinetix.garmin_sync_events` queue table (idempotent on Garmin event id).
3. Background worker (Vercel Cron + queue) drains the table and ingests into `kinetix.activities` / `kinetix.health_metrics`.
4. Manual re-trigger via `POST /api/garmin-sync/trigger` (operator only).

### Option B - Scheduled pull

1. Vercel Cron (every 30 min) calls `apis.garmin.com/.../activities?since=<checkpoint>` per user.
2. Same ingest path as Option A.

### Common to both

- **Idempotency:** dedup on `(user_id, garmin_event_id)` or `(user_id, activity_id)`.
- **Checkpoints:** track per-user last-sync timestamp in `platform.identity_links.last_synced_at` (or kinetix-local equivalent).
- **Backoff:** respect Garmin rate-limit headers; exponential backoff on 429.
- **Failure budget:** alert if any user is >24h behind sync.

Tests live in `api/_lib/garminSync.test.ts` (new) with `nock` or `vi.spyOn(globalThis, 'fetch')` mocks.

## C5 - Server-side encrypted token store (3-5 days)

Replaces the current per-device storage in `apps/web/src/store/settingsStore.ts`.

1. New table `platform.garmin_tokens`:
   - `user_id uuid pk` (references `auth.users`)
   - `garmin_user_id text`
   - `access_token text` (encrypted via pgcrypto with a project-level key)
   - `refresh_token text` (encrypted)
   - `expires_at timestamptz`
   - `created_at`, `updated_at`
2. New API:
   - `GET /api/garmin-tokens` (Bearer JWT) - returns presence+expiry only, never the token
   - `POST /api/garmin-tokens` - exchange code (replaces direct client storage flow)
   - `DELETE /api/garmin-tokens` - disconnect
3. Update `apps/web/src/hooks/useGarminConnectAuth.ts` to call the new API rather than persisting in `settingsStore`.
4. Migrate existing client-stored tokens (if any) at next login by walking the settings blob and posting to the new endpoint, then clearing.

## C6 - Tests (2 days)

1. **Vitest:** add integration tests in `api/_lib/garminSync.test.ts` and `apps/web/src/lib/garminConnect.integration.test.ts`. Mock Garmin API responses; cover happy path, 401 (refresh), 429 (backoff), 5xx (retry).
2. **Playwright:** add `apps/web/e2e/garmin-settings.spec.ts` that walks Settings -> Connect Garmin (mocked OAuth in dev / staging), verifies success state.
3. Wire both into the existing CI workflows (`web-ci.yml` for vitest, `web-e2e.yml` for Playwright).

## C7 - Re-enable Garmin on iOS (3-4 days)

Reverses Lane B4 (which removed simulated Garmin).

1. Add a new iOS `GarminService` that calls **Kinetix server API** (not Garmin directly):
   - `GET /api/garmin-tokens` to know whether the user is connected
   - `GET /api/garmin/activities?since=<...>` for run summaries (server proxies to Garmin)
2. UI gate: `Features.garminEnabled = true` once the server endpoints are live.
3. Watch app continues to read on-device HealthKit; Garmin enriches the iPhone data layer only.
4. Re-add Garmin tab to Settings.
5. iOS app store update submission with feature.

## Definition of done (Lane C)

- [ ] Production checkout for a subscribed user: Connect Garmin -> token in `platform.garmin_tokens` -> first sync writes activities.
- [ ] Background sync runs for 7 days continuously without manual intervention.
- [ ] Webhook re-delivery after a planned 5-min outage: backlog drains within 30 min.
- [ ] iOS app shows Garmin tab populated.
- [ ] [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) "Lane C closure" rows all PASS.
