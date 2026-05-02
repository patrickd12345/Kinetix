# Kinetix Integration Token Threat Model

## Scope

This threat model covers Strava and Withings integration tokens used by the Kinetix web client and serverless API.

## Current Contract

- Strava and Withings access and refresh tokens are stored server-side in `kinetix.provider_token_vault`.
- Browser-visible state is limited to non-secret connection metadata such as provider, connected status, provider user id, expiry, and sync timestamps.
- Provider API calls use authenticated Kinetix API proxies; the browser sends the Supabase session token, not provider tokens.
- Strava and Withings tokens must never be written to console output or serialized in browser API responses.
- Support, RAG, AI, analytics, and operator endpoints must not receive integration tokens.

## Risks

- The vault stores token material with service-role access only; compromise of server runtime credentials remains high impact.
- Client connection markers can become stale if the server-side vault row is manually removed; reload fetches provider connection state to repair the UI.
- Legacy browser token material may exist in old local storage snapshots until the local scrubbing migration runs for that user/browser.

## Interim Mitigations

- Keep token-bearing requests inside server-only handlers and provider proxies.
- Do not log access tokens, refresh tokens, authorization headers, credential objects, or vault rows.
- Keep markdown and user-generated content sanitized before rendering.
- Use `apps/web/src/test/integration-token-security.test.ts` to guard browser token exposure and token-bearing response regressions.

## Follow-up Migration Task

Provider-token-vault rollout is complete for new Strava and Withings OAuth connections. Remaining follow-up: live staging verification with dedicated Strava/Withings accounts, operator-visible revocation audit, and a one-time cleanup notice for any browsers that had pre-vault tokens before the local scrubbing migration ran.
