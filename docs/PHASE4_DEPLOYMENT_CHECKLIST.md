# Phase 4 — Deployment checklist

**Last updated:** 2026-04-10  
**Guardrail:** Wave 2 web **closed**; checklist is for **release** — no feature work.

## A. Build and quality (pre-merge / pre-deploy)

- [ ] `pnpm lint` — clean (warnings treated as failures per project practice).
- [ ] `pnpm type-check` — clean.
- [ ] `pnpm --filter @kinetix/web test` — Vitest green (baseline count in [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md)).
- [ ] `pnpm run verify:vercel-parity` — **PASS** (install + type-check + lint + build path aligned with Vercel).

## B. Environment

- [ ] Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_*` equivalents) per [`ENV_PARITY.md`](deployment/ENV_PARITY.md).
- [ ] Same Supabase project as Bookiji for SSO — see ENV_PARITY **If these differ**.
- [ ] Supabase Auth redirect URLs include production and preview origins for Kinetix.
- [ ] Optional OAuth: only enable providers with credentials configured.
- [ ] Billing (if live): Stripe secret, price id, Bookiji webhook path per [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).
- [ ] Help Center ops: operator IDs, RAG base URL, support secrets per [`HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md).

## C. Database / migrations

- [ ] **No ad-hoc SQL** in dashboard for schema — migrations only (org rule); Kinetix-owned migrations under `supabase/migrations/` when this repo owns the change.
- [ ] Confirm **`kinetix.*`** support tables present in target environment for Help Center (see [`PROJECT_PLAN.md`](PROJECT_PLAN.md) data model section).

## D. Post-deploy verification

- [ ] [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md) — admlog 403 on production, SSO smoke, entitlement gating.
- [ ] [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md) — if Help Center is in scope for the release.

## E. DNS / domain

- [ ] [`KINETIX_SUBDOMAIN.md`](deployment/KINETIX_SUBDOMAIN.md) (if DNS changes).

## References

- [`PHASE4_ENV_PARITY.md`](PHASE4_ENV_PARITY.md)
- [`vercel.json`](../vercel.json) — build output and `api` routes.
