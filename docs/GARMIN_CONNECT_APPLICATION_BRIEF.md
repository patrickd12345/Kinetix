# Garmin Connect Developer Program - application brief

Paste sections into the application form at <https://developer.garmin.com/gc-developer-program/overview/>. Form fields evolve; map this content to whichever fields exist on the live form. The brief is intentionally factual and matches what the codebase already implements.

## Company / applicant

- **Legal entity:** Bookiji Inc.
- **Product:** Kinetix - AI-powered running coach (web app, iOS app, watchOS app).
- **Primary domain:** <https://kinetix.bookiji.com>
- **Privacy policy:** <https://kinetix.bookiji.com/privacy> (or canonical Bookiji Inc privacy URL - confirm before submission).
- **Terms of service:** <https://kinetix.bookiji.com/terms>
- **Support contact:** support@bookiji.com (substitute live address).
- **Technical contact:** <engineering lead email - fill in before submission>

## Product description (short)

Kinetix is an AI-driven running coach. We ingest a runner's training, sleep, and recovery signals, compute a "Kinetix Performance Score" and personalized weekly plans, then coach the user via voice + text. We support imports from Strava (already live), Withings (live), file-based Garmin imports today, and want to add **Garmin Connect partner sync** so a runner's training and wellness data flows in continuously without manual exports.

## Why we need partner API access

- Continuous training + wellness signals (workouts, sleep, HRV, body battery, stress) into the coach.
- Push-driven freshness instead of file-export workflows that frustrate users.
- Activity rich data (laps, HR series) for accurate post-run analysis.
- Match feature parity already shipped for Strava and Withings.

## APIs we need

- **Health API** (sleep, stress, body battery, HRV, daily summaries, user metrics)
- **Activity API** (activity summaries, activity details, activity files)
- Optional: **Wellness/Health Snapshot** if available in our region.

## Data domains and retention

| Domain | Used for | Retention | Stored where |
|--------|----------|-----------|--------------|
| Activities (workouts) | Coach feedback, weekly plans, KPS | Active account lifetime; deletable on request | Supabase `kinetix.activities` |
| Sleep + HRV + stress | Recovery score | 18 months rolling | Supabase `kinetix.health_metrics` |
| Daily summaries | Trends and progress | 18 months rolling | Same |
| User identity (Garmin partner user id) | Token<->user mapping | Active account lifetime | Supabase `platform.identity_links` (planned) |

We do not sell or share Garmin data with third parties. Data export and deletion follow user request within 30 days. Deletion cascades to derived metrics.

## Technical readiness (built today)

The repo already implements the documented partner shape, awaiting credentials:

- **OAuth 2.0 with PKCE** end-to-end:
  - Authorize URL launch in [`apps/web/src/hooks/useGarminConnectAuth.ts`](../apps/web/src/hooks/useGarminConnectAuth.ts)
  - PKCE helpers in [`apps/web/src/lib/garminConnectPkce.ts`](../apps/web/src/lib/garminConnectPkce.ts)
  - Token exchange (`POST /api/garmin-oauth`) in [`api/garmin-oauth/index.ts`](../api/garmin-oauth/index.ts) using [`api/_lib/garminOAuth.ts`](../api/_lib/garminOAuth.ts)
  - Token refresh (`POST /api/garmin-refresh`) in [`api/garmin-refresh/index.ts`](../api/garmin-refresh/index.ts)
  - Server-side fetch of Garmin user id from `apis.garmin.com/wellness-api/rest/user/id`
  - Settings UI for Connect / Disconnect: [`apps/web/src/pages/Settings.tsx`](../apps/web/src/pages/Settings.tsx)
- Test coverage: [`api/_lib/garminOAuth.test.ts`](../api/_lib/garminOAuth.test.ts) (mocked Garmin token responses).
- Existing similar integrations live in production: Strava OAuth ([`api/strava-oauth`](../api/strava-oauth)), Withings OAuth ([`api/withings-oauth`](../api/withings-oauth)).

## Roadmap once credentials are issued (planned, by phase)

1. Phase 1 - Connect / Disconnect surface in production for beta users (live today behind missing credentials).
2. Phase 2 - **Server-side sync pipeline**: scheduled pull or webhook on `apis.garmin.com`, ingest into `kinetix.activities` + `kinetix.health_metrics`.
3. Phase 3 - **Server-side encrypted token store** keyed by Supabase user id (replaces current per-device storage).
4. Phase 4 - iOS surface re-enabled, reading from Kinetix sync API (no direct Garmin call from device).

## Compliance and posture

- We do not use any unofficial Garmin libraries (no `python-garminconnect`, etc.). Decision recorded in [`GARMIN_CONNECT_DEVELOPER_PROGRAM.md`](GARMIN_CONNECT_DEVELOPER_PROGRAM.md).
- Garmin client secret is stored only in Vercel server env + Infisical (`/platform`); never embedded in any client bundle.
- We will respect Garmin Connect IQ data display rules and rate limits per the program documentation.
- We will support the standard Garmin user opt-out and account deletion paths.

## Beta evidence (fill in before submission)

| Metric | Value | Source |
|--------|-------|--------|
| Active monthly runners (last 30 days) | <fill in> | analytics dashboard |
| Strava connections in beta | <fill in> | Supabase query |
| Withings connections in beta | <fill in> | Supabase query |
| Garmin file imports completed | <fill in> | `kinetix.garmin_imports` count |
| Paid subscribers (live billing on) | <fill in> | Stripe dashboard |

## Submission checklist (operator)

- [ ] Privacy policy and terms URLs confirmed live.
- [ ] Beta evidence numbers refreshed (within 7 days).
- [ ] Application form submitted at <https://developer.garmin.com/gc-developer-program/overview/>.
- [ ] Application receipt id recorded in [`PROJECT_PLAN.md`](PROJECT_PLAN.md) "Lane C status" cell.
- [ ] Application receipt id recorded in [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) under "Lane C - application submitted".
