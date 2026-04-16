# Kinetix Security Report

Audit date: 2026-04-11

## Controls Observed

- Protected routes gate through `AuthProvider` and entitlement check.
- `VITE_SKIP_AUTH` and `VITE_MASTER_ACCESS` are local/test-oriented; `MASTER_ACCESS` throws if set in production build mode.
- API handlers consistently call `applyCors`.
- AI endpoints reject unsupported methods and BYOK header usage.
- Support ops status patch requires configured ops secret and matching header/Bearer token.
- Admlog package disables production use.
- Billing checkout requires Bearer token and validates Supabase session.

## Findings

| ID | Severity | Evidence | Finding |
|---|---|---|---|
| SEC-01 | P1 | `SupportQueue.tsx` renders `ReactMarkdown` with custom link renderer and `href={href}` from queue/KB content. | Markdown links should be protocol-sanitized and constrained; `rel="noreferrer"` is present, but allowed URL schemes are not explicit. |
| SEC-02 | P1 | `settingsStore.ts` persists `withingsCredentials`, `stravaCredentials`, and legacy `stravaToken` in localStorage. | Browser-stored long-lived refresh tokens increase blast radius of XSS/local compromise. |
| SEC-03 | P2 | `api/_lib/supportOperator.ts` allows `vite-skip-auth-bypass` when `MASTER_ACCESS` is true. | Correct for E2E, but must be verified impossible in production env parity and deployment checks. |
| SEC-04 | P2 | `lighthouserc.json` cannot run CSP/XSS Lighthouse checks because URL is placeholder. | Security-adjacent browser audits are not active. |
| SEC-05 | P2 | Live/staging smoke was not executed because no staging URL/test account was provided in the prompt or repo context. | Real SSO, cookie, OAuth provider, and entitlement behavior remain unverified in this run. |
| SEC-06 | P3 | CORS/method tests exist for selected routes, but not every API handler has direct negative tests. | Add uniform negative tests for all Vercel functions. |

## API/Auth Notes

- `api/ai-chat` and `api/ai-coach` support `API_REQUIRE_AUTH`; tests cover unauthorized errors.
- `api/strava-proxy` forwards Authorization to Strava and returns API error objects.
- `api/withings` handles OAuth code/refresh token flows through server-side secret use.
- `api/support-queue/*` uses support operator resolution and Supabase-backed store.

