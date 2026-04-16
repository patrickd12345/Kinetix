# Kinetix Live/Staging Smoke Runbook

## Prerequisites

- Dedicated staging URL that is not production.
- Dedicated test account with Kinetix entitlement.
- Test account may connect disposable Strava/Withings sandbox credentials only.
- Operator/support access must be granted to the same test account or a second named operator account.

## Prohibited During Smoke

- Do not mutate production data.
- Do not use personal third-party health credentials.
- Do not enable `VITE_MASTER_ACCESS`, `VITE_SKIP_AUTH`, `ADMLOG_ENABLED`, or `BOOKIJI_TEST_MODE` in production-like environments.

## Smoke Checklist

1. Login: authenticate through the configured Supabase/Bookiji SSO provider and verify return to `/`.
2. Protected routes: open `/`, `/history`, `/coaching`, `/weight-history`, `/menu`, `/chat`, `/settings`, `/help`, `/operator`, and `/support-queue`; verify no unexpected `/login` redirect after authentication.
3. Entitlement: verify a known non-entitled account receives the entitlement-required screen and cannot access protected route content.
4. AI endpoint reachability: submit one deterministic coach prompt from Chat and one run analysis from History using non-sensitive fixture data.
5. Settings integrations: verify Strava and Withings connection visibility, disabled/error states, and no secret values shown in UI or console.
6. Operator and Queue: verify operator dashboard loads, support queue list loads, invalid ops secret is rejected, and ticket updates are only made against staging fixtures.
7. Observability: capture request ids for any API failure and confirm runtime logs contain no integration tokens.

## Evidence To Record

- Staging URL and deployment id.
- Test account id/email alias.
- Date/time of smoke.
- Route pass/fail table.
- Console errors/warnings.
- API failures with request ids.
- Any data intentionally created during the run and cleanup status.
