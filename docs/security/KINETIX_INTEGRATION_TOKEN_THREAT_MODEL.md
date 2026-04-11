# Kinetix Integration Token Threat Model

## Scope

This interim threat model covers browser-held Strava and Withings integration tokens used by the current Kinetix web client. It documents the risk accepted for this remediation pass and the required migration follow-up.

## Current Contract

- Strava and Withings tokens must never be written to console output.
- Integration tokens may only be sent to their intended proxy or refresh endpoints.
- Support, RAG, AI, analytics, and operator endpoints must not receive integration tokens.
- Full server-side token storage is deferred because it requires coordinated auth, persistence, migration, deployment secret, and rollback work.

## Risks

- Browser storage can be read by script running in the same origin after an XSS compromise.
- Client-side token refresh makes endpoint scoping and logging hygiene critical.
- Local persistence does not provide centralized revocation or rotation auditing.

## Interim Mitigations

- Keep token-bearing requests constrained to `/api/strava-refresh`, `/api/strava/*`, and intended Withings endpoints.
- Do not log access tokens, refresh tokens, authorization headers, or credential objects.
- Keep markdown and user-generated content sanitized before rendering.
- Treat server-side encrypted token storage as a release-blocking design milestone before broad third-party integration rollout.

## Follow-up Migration Task

Move Strava and Withings refresh tokens to server-side encrypted storage keyed by authenticated user id. The browser should receive connection state and short-lived operation results, not refresh tokens. The migration needs database schema, backfill/clear flow, OAuth callback changes, revocation handling, and staging verification with dedicated test accounts.
