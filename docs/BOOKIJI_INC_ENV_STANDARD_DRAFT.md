# Bookiji Inc env standard draft

**Status:** Draft for KX-FEAT-004  
**Pilot repo:** Kinetix  
**See also:** [`deployment/INFISICAL_CANONICAL_SECRETS.md`](deployment/INFISICAL_CANONICAL_SECRETS.md), [`deployment/INFISICAL_LOCAL_DEV.md`](deployment/INFISICAL_LOCAL_DEV.md), workspace [`docs/platform/secret-management.md`](../../../docs/platform/secret-management.md)

## Kinetix pilot status

Kinetix is the current pilot for making **Infisical the canonical source of truth** for Bookiji Inc application secrets while keeping deployment-time validation and browser-runtime safety intact.

Current KX-FEAT-004 pilot scope:

- local developer flow documented with `pnpm dev:infisical`
- verification flow documented with `pnpm verify:infisical`
- canonical ownership policy documented for `/platform` and `/kinetix`
- transitional sync targets documented for Vercel and GitHub
- staging smoke expectations documented for env-source status

Pilot completion does **not** mean every runtime has already been migrated to automatic sync. It means the policy, operator checklist, and local validation flow are defined tightly enough to be applied consistently.

## Proposed umbrella standard

All Bookiji Inc products should follow the same baseline:

1. **Canonical store:** Infisical is the primary source of truth for long-lived secrets.
2. **Path model:** `/platform` contains shared platform secrets; `/{product}` contains product-specific secrets.
3. **Environment model:** `dev` backs local plus preview; `prod` backs production.
4. **Deployment sync:** deployment systems receive secrets from the canonical store or from a documented sync/fallback path tied back to the canonical store.
5. **Runtime validation:** apps validate required configuration and fail safely when required env vars are missing, with stronger deploy-time fail-closed enforcement as the target state.
6. **Safe logging only:** logs may contain missing variable names, path names, and validation status, but never secret values.

## Promotion criteria before broader rollout

Do not copy this standard from Kinetix into other products until the pilot demonstrates:

1. Local developers can use `pnpm dev:infisical` or an equivalent validated wrapper without committing secrets.
2. `pnpm verify:infisical` or equivalent validation clearly identifies missing env requirements.
3. Preview and production deployment targets have a documented sync path from Infisical.
4. Production deploys have a documented path toward fail-closed enforcement when required env vars are missing.
5. No product requires Infisical access from the browser at runtime.
6. Operator documentation is specific enough that humans can recover from drift without guessing.
7. Audit logs and approval steps are defined for production-affecting changes.

## Rollout candidates after Kinetix

Once the pilot criteria above are met, the same standard can be evaluated for:

- Bookiji
- MyAssist
- JobHunt
- Prompteus
- Foodaloo
- CashCity
- any additional Bookiji Inc product added later

Each product should reuse the **policy** and **path model**, but keep product-local wrappers and validation focused on its own runtime needs.

## Non-browser-runtime rule

No product may require Infisical at browser runtime.

That means:

- no client-side token exchange with Infisical
- no direct browser reads from Infisical APIs
- no login flow that depends on Infisical access from the user device

Secrets must be injected before runtime through deployment-time configuration, server-side retrieval, or validated local development tooling.

## Fail-closed deployment target

Production deploys should eventually fail closed if required env vars are missing. For the KX-FEAT-004 pilot, that is a target-state standard to document and verify explicitly rather than a guarantee implied by these docs alone.

Examples:

- missing Supabase URL or publishable key for a web client
- missing service-role or server integration secret for a required backend path
- missing Stripe, OAuth, or platform secret required by enabled production features

Silent fallback to stale manual configuration is not acceptable as the long-term steady state.

## Transitional note

During rollout, some products may still use manual Vercel or GitHub environment maintenance. That state is acceptable only when:

- the canonical values already live in Infisical
- the manual step is documented as transitional
- the owner and rollback path are explicit
- drift checks remain possible

## Adoption checklist template

Before declaring a product aligned with the standard, confirm:

- [ ] Infisical path ownership is documented
- [ ] local validated workflow is documented
- [ ] required env validation is documented
- [ ] preview mapping is documented
- [ ] production mapping is documented
- [ ] emergency local fallback is documented
- [ ] no-secret-logging rule is documented
- [ ] browser-runtime non-goal is explicit
- [ ] target-state production validation rule is explicit
