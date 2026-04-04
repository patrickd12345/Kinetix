# Product Technical Scope

Product: Kinetix  
Type: mixed platform

## Platform Standards Applicability

| Capability | Status | Notes |
|------------|--------|------|
| Shared identity (`platform.profiles` / `platform.entitlements`) | Compliant | Web `AuthProvider` + `platformAuth`; optional dev `/api/admlog` via `@bookiji-inc/platform-auth`. |
| AI Runtime | Applicable | AI is an active web, API, and mobile surface. |
| Stripe Runtime | N/A | No confirmed Stripe runtime or billing webhook surface is part of the current product architecture. |
| CI Baseline | Partial | CI exists, but baseline coverage does not consistently cover all active surfaces. |
| Env Contract | Partial | Canonical env work exists, but runtime resolution is still mixed across surfaces. |
| Observability | Partial | Observability helpers exist, but usage is not consistent across API and app paths. |
| Feature Flags | Partial | Flag-related runtime and schema surfaces exist, but governance and adoption are incomplete. |
| Error Contract | Partial | Canonical error handling exists on some API paths, but not across the whole product. |

## Architecture Intent

Mixed web, API, and mobile product with AI surfaces in scope and uneven platform standard adoption.

## Out of Scope

- Stripe recommendations unless a real billing runtime is introduced
- Billing scaffolding where no billing surface exists

## Audit Instructions

Future audit agents must:

- Read this file first
- Treat N/A as intentional
- Treat Partial as real gaps
- Avoid proposing out-of-scope architecture
