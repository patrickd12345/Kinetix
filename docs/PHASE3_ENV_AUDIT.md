# Phase 3 — Environment uniformity audit

**Last updated:** 2026-04-10  
**Guardrail:** Wave 2 web **closed**; this is a **mapping** and **gap** log — no new feature envs.

## Server runtime (`api/`)

Canonical resolver: [`api/_lib/env/runtime.ts`](../api/_lib/env/runtime.ts) → `resolveKinetixRuntimeEnvFromObject` from **`./runtime.shared.mjs`** (built/shared layer). Exposes a wide **`KinetixRuntimeEnv`** including:

- Supabase URL/keys, Stripe, Strava/Withings OAuth, AI gateway/Ollama, Chroma/RAG URLs, support operator IDs, Slack/email/Resend, `apiRequireAuth`, etc.

**Uniformity note:** Server code should read env **only** through `resolveKinetixRuntimeEnv()` or explicit `process.env` where documented (e.g. `escalationNotify` reads `VITE_ENABLE_ESCALATION` and `ESCALATION_SLACK_WEBHOOK_URL` — bridge between client-named flag and server secret).

## Web client (`apps/web`)

[`apps/web/src/lib/supabaseClient.ts`](../apps/web/src/lib/supabaseClient.ts):

- **`VITE_SUPABASE_URL`** then fallback **`NEXT_PUBLIC_SUPABASE_URL`**
- **`VITE_SUPABASE_ANON_KEY`** then **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** then **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**

Feature flags and operator UI: `VITE_*` per [`HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md) (`VITE_ENABLE_OPERATOR_DASHBOARD`, `VITE_ESCALATION_PROXY_URL`, etc.).

## Cross-check: deployment docs

| Document | Focus |
|----------|--------|
| [`docs/deployment/ENV_PARITY.md`](deployment/ENV_PARITY.md) | SSO with Bookiji — **same Supabase project**; `VITE_*` client vars; admlog production safety. |
| [`docs/deployment/INFISICAL_LOCAL_DEV.md`](deployment/INFISICAL_LOCAL_DEV.md) | Infisical paths and merge order for local dev. |
| [`docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md) | Billing — server Stripe secret + price id; Bookiji webhook owns entitlements. |

## Uniformity gaps (tracked)

1. **Dual naming (`VITE_` vs `NEXT_PUBLIC_`)** — intentional for Vite + migration; clients already fallback — **documented** in ENV_PARITY.
2. **Server vs client flag names** — escalation uses **`VITE_ENABLE_ESCALATION`** on server in `escalationNotify` (unusual pattern); operators should treat as **documented exception** or follow-up to server-only name in a future hardening pass.
3. **RAG service env** — `apps/rag` has its own env surface; not fully enumerated here — see `apps/rag/README.md` for Chroma/Ollama.

## References

- [`PHASE4_ENV_PARITY.md`](PHASE4_ENV_PARITY.md) — release-readiness cross-check.
- [`PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) — env contract **Partial** row.
