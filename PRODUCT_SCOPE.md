# Product Technical Scope

Product: Kinetix  
Type: mixed platform

**Wave 2 web verification:** CLOSED (2026-04-10 recorded evidence). Remaining **Partial** platform rows track **Phase 3 — Platform Hardening** in [`docs/KINETIX_SCOPE_CLOSURE.md`](docs/KINETIX_SCOPE_CLOSURE.md) (not blocking release).

## Platform Standards Applicability

| Capability | Status | Notes |
|------------|--------|------|
| AI Runtime | Applicable | AI is an active web, API, and mobile surface. |
| Stripe Runtime | Applicable | Checkout on Kinetix (`POST /api/billing/create-checkout-session`); canonical webhook on Bookiji (`POST /api/payments/webhook`) updates `platform.entitlements`. See [`docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md`](docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md). |
| CI Baseline | Partial | Wave 2 closure (2026-04-10): local `pnpm --filter @kinetix/web test` green (**346** tests that day); current totals drift — see [`docs/KINETIX_LOCAL_VERIFICATION_BASELINE.md`](docs/KINETIX_LOCAL_VERIFICATION_BASELINE.md). Keep `pnpm lint` and `pnpm type-check`; CI workflow should keep running the same gates; native and RAG surfaces still need explicit job coverage where applicable. |
| Env Contract | Partial | Canonical env work exists, but runtime resolution is still mixed across surfaces. |
| Observability | Partial | Observability helpers exist, but usage is not consistent across API and app paths. |
| Feature Flags | Partial | Flag-related runtime and schema surfaces exist, but governance and adoption are incomplete. |
| Error Contract | Partial | Wave 2: expanded API/app tests include error-route coverage (e.g. `apps/web/src/test/ai-route-errors.test.ts`); full uniform adoption across every `api/*` handler remains open. |

## Architecture Intent

Mixed web, API, and mobile product with AI surfaces in scope and uneven platform standard adoption.

## Out of Scope

- A second Stripe webhook endpoint on Kinetix (org rule: single canonical webhook on Bookiji)
- Billing UX or pricing experiments not backed by an ADR or product decision

## Audit Instructions

Future audit agents must:

- Read this file first
- Treat N/A as intentional
- Treat Partial as real gaps
- Avoid proposing out-of-scope architecture
