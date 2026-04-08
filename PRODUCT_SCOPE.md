# Product Technical Scope

Product: Kinetix  
Type: mixed platform

## Platform Standards Applicability

| Capability | Status | Notes |
|------------|--------|------|
| AI Runtime | Applicable | AI is an active web, API, and mobile surface. |
| Stripe Runtime | Applicable | Checkout on Kinetix (`POST /api/billing/create-checkout-session`); canonical webhook on Bookiji (`POST /api/payments/webhook`) updates `platform.entitlements`. See [`docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md`](docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md). |
| CI Baseline | Partial | CI exists, but baseline coverage does not consistently cover all active surfaces. |
| Env Contract | Partial | Canonical env work exists, but runtime resolution is still mixed across surfaces. |
| Observability | Partial | Observability helpers exist, but usage is not consistent across API and app paths. |
| Feature Flags | Partial | Flag-related runtime and schema surfaces exist, but governance and adoption are incomplete. |
| Error Contract | Partial | Canonical error handling exists on some API paths, but not across the whole product. |

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
