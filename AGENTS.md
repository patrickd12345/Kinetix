# BKI-043 Workstream D

## Product Identity
- Kinetix is the running-coach product (web + iOS + watchOS), not a generic platform shell.
- Keep `apps/web` as the active web surface; treat `archive/web-legacy` as reference only.

## Package Manager Rule
- pnpm only. Do not run `npm install` and do not commit `package-lock.json`.

## Persistence Model
- Web/platform persistence is shared Supabase (`kinetix.*` plus `platform.*` for cross-product identity and entitlements).
- Native persistence is on-device (SwiftData/HealthKit run data) with explicit sync boundaries; do not invent mirror stores.

## Auth Model
- Web auth is Supabase Auth (`auth.users`) with entitlement checks from `platform.entitlements` (`product_key='kinetix'`).
- Never ship or enable production auth bypasses (`VITE_SKIP_AUTH`, master-access toggles, dev-only gates).

## External Integrations
- Stripe checkout starts in Kinetix (`POST /api/billing/create-checkout-session`); canonical webhook is Bookiji-only (`POST /api/payments/webhook`).
- Active integrations include Supabase, Stripe, Infisical, and Kinetix product providers (for example Strava/Withings).

## Testing Contract
- Run from `products/Kinetix`.
- Minimum gate for code changes: `pnpm lint`, `pnpm type-check`, targeted tests first (`pnpm --filter @kinetix/web test`), then broaden (`pnpm test:e2e`) when user-facing flows change.

## Change Policy
- Preserve current architecture intent and documented boundaries; do not add a second Stripe webhook path.
- Keep changes scoped; do not revert concurrent edits you did not author.

## Standards Docs Updates
- Update `../../docs/standards/` when a rule becomes Bookiji-wide or product-standard policy.
- Update this `AGENTS.md` when Kinetix-local execution rules change.
- Update `PRODUCT_SCOPE.md` for standards status changes.
- Update `docs/KINETIX_SCOPE_CLOSURE.md` when closure/hardening state changes.
- Update `docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md` for billing/entitlement contract changes.
