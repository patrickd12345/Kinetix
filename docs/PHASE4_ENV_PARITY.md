# Phase 4 — Environment parity (readiness)

**Last updated:** 2026-04-10  
**Source checklist:** [`docs/deployment/ENV_PARITY.md`](deployment/ENV_PARITY.md)  
**Guardrail:** Wave 2 web **closed**; this validates **readiness** only.

## Validation against runtime

| ENV_PARITY topic | Runtime expectation | Status |
|------------------|---------------------|--------|
| Same Supabase project as Bookiji | Web client must use **`VITE_SUPABASE_*`** (or `NEXT_PUBLIC_*` fallbacks) matching Bookiji `NEXT_PUBLIC_*` | Required for SSO — see [`supabaseClient.ts`](../apps/web/src/lib/supabaseClient.ts). |
| OAuth provider toggles | `VITE_AUTH_*_ENABLED` — optional; hide buttons when unset/false | Matches passwordless + optional OAuth standard in ENV_PARITY. |
| Admlog disabled in production | `isAdmlogEnabled()` / production guard in [`api/admlog/index.ts`](../api/admlog/index.ts) | Production must return safe **403** — manual step in [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md). |
| Infisical prod | `pnpm verify:infisical` / `verify-infisical.mjs --env=prod` | Ensures **`ADMLOG_ENABLED`** not true in prod merge. |

## Fallback logic (client)

Documented in ENV_PARITY and implemented: **`VITE_` first**, then **`NEXT_PUBLIC_`** for Supabase URL and anon/publishable key — reduces drift when only one naming convention is set in a given environment.

## Operator / support stack

[`HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md) lists server envs (`KINETIX_*`, `SUPABASE_*`, Slack, Resend). These are **additional** to the SSO pair — Phase 4 release for Help Center requires them for full smoke; SSO-only parity does not imply support queue works.

## Gaps to resolve before production cutover

1. Confirm **Preview vs Production** Infisical → Vercel mapping for **`/kinetix`** paths (see ENV_PARITY **Vercel project and Infisical sync** table).
2. Align **Stripe** secrets and price id with [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md) when billing goes live.

## References

- [`PHASE4_DEPLOYMENT_CHECKLIST.md`](PHASE4_DEPLOYMENT_CHECKLIST.md)
- [`PHASE3_ENV_AUDIT.md`](PHASE3_ENV_AUDIT.md)
