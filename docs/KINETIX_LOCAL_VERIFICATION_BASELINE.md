# Kinetix Local Verification Baseline

This runbook is the minimum baseline required before executing Integration Wave 1.

## Required workspace health conditions

1. Local `packages/*` includes deterministic `@bookiji-inc/*` stub manifests:
   - `ai-runtime/package.json`
   - `error-contract/package.json`
   - `observability/package.json`
   - `persistent-memory-runtime/package.json`
   - `platform-auth/package.json`
   - `stripe-runtime/package.json`
2. `packages/core/package.json` and `apps/web/package.json` are resolvable in the workspace graph.
3. `pnpm-lock.yaml` can be consumed by the installed pnpm version (`10.30.3` from `packageManager`).

## Current blocker classification (2026-04-10, updated)

### Product verification blockers

- None confirmed yet. Wave 1 product assertions have not executed in this environment.

### Workspace/tooling blockers

- Workspace-package integrity blocker is resolved by local stubs under `packages/*`; `workspace:*` links now resolve.
- `pnpm install` currently fails in this environment with registry fetch/auth restrictions (`ERR_PNPM_FETCH_403`) from `https://registry.npmjs.org/*`.
- Smallest irreducible package prerequisite for Wave 1 execution is currently `jsdom@24.1.3` (`apps/web` test runtime), plus `@testing-library/react` and `@testing-library/user-event`.

## Deterministic setup steps

```bash
# 1) Prepare shared Bookiji packages for workspace:* references
pnpm install --no-frozen-lockfile

# 3) Run Wave 1 lint gate
pnpm --filter @kinetix/web lint

# 4) Run targeted Wave 1 integration tests
pnpm --filter @kinetix/web test -- \
  src/integration/auth-entitlement.integration.test.ts \
  src/integration/app-entry-guard.integration.test.ts \
  src/integration/menu-route.integration.test.ts \
  src/integration/help-route.integration.test.ts \
  src/integration/help-center-support.integration.test.ts \
  src/pages/History.integration.test.tsx
```

## Exact rerun command bundle for Wave 1 (after npm registry access is restored)

```bash
pnpm install --no-frozen-lockfile && \
pnpm --filter @kinetix/web lint && \
pnpm --filter @kinetix/web test -- \
  src/integration/auth-entitlement.integration.test.ts \
  src/integration/app-entry-guard.integration.test.ts \
  src/integration/menu-route.integration.test.ts \
  src/integration/help-route.integration.test.ts \
  src/integration/help-center-support.integration.test.ts \
  src/pages/History.integration.test.tsx
```
