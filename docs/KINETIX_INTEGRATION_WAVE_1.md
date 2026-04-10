# Kinetix Integration Wave 1

Integration Wave 1 Status: Blocked (irreducible external npm registry access prerequisite)

## Authentication

### Login
Status: Pending (blocked by environment)

### Session persistence
Status: Pending (blocked by environment)

### Logout
Status: Pending (blocked by environment)

### Protected routes
Status: Pending (blocked by environment)

## Layout / Navigation

### Navigation works from all pages
Status: Pending (blocked by environment)

### Mobile layout
Status: Pending (blocked by environment)

### Error boundary
Status: Pending (blocked by environment)

### Loading states
Status: Pending (blocked by environment)

## Help Center

### Open help center
Status: Pending (blocked by environment)

### Navigation inside help
Status: Pending (blocked by environment)

### Back navigation
Status: Pending (blocked by environment)

### Empty states
Status: Pending (blocked by environment)

## History

### Load history
Status: Pending (blocked by environment)

### Empty state
Status: Pending (blocked by environment)

### Loading state
Status: Pending (blocked by environment)

### Provider path
Status: Pending (blocked by environment)

### Fallback path
Status: Pending (blocked by environment)

# Issues Found

## Workspace/tooling blockers

- Workspace references for `@bookiji-inc/*` were restored with deterministic local stub packages under `packages/*`, removing the prior `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` blocker.
- `pnpm install --no-frozen-lockfile` now resolves workspace graph but still fails on external registry fetch (`ERR_PNPM_FETCH_403` on `registry.npmjs.org`), so lint/tests cannot execute in this environment.
- External network/proxy policy currently prevents downloading remaining npm tarballs required by `apps/web` test/lint toolchain.


### Exact 403 package sequence observed (2026-04-10)

| Package | Registry URL | Dependency path | Classification | Needed for Wave 1? |
|---|---|---|---|---|
| `@types/react-dom@18.3.7` | `https://registry.npmjs.org/@types/react-dom/-/react-dom-18.3.7.tgz` | `apps/web` direct `devDependencies` | dev-only typing | no |
| `@testing-library/user-event@14.6.1` | `https://registry.npmjs.org/@testing-library/user-event/-/user-event-14.6.1.tgz` | `apps/web` direct `devDependencies` | test runtime | yes |
| `@playwright/test@1.58.2` | `https://registry.npmjs.org/@playwright/test/-/test-1.58.2.tgz` | `apps/web` direct `devDependencies` | e2e-only | no |
| `@testing-library/react@16.3.2` | `https://registry.npmjs.org/@testing-library/react/-/react-16.3.2.tgz` | `apps/web` direct `devDependencies` | test runtime | yes |
| `@typescript-eslint/eslint-plugin@6.21.0` | `https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-6.21.0.tgz` | `apps/web` direct `devDependencies` | lint-only | no (for Wave 1 assertions) |
| `@typescript-eslint/parser@6.21.0` | `https://registry.npmjs.org/@typescript-eslint/parser/-/parser-6.21.0.tgz` | `packages/core` direct `devDependencies` | lint/type tooling | no (for Wave 1 assertions) |
| `@vercel/node@3.2.29` | `https://registry.npmjs.org/@vercel/node/-/node-3.2.29.tgz` | root direct `dependencies` | deployment/runtime adapter | no |
| `adm-zip@0.5.16` | `https://registry.npmjs.org/adm-zip/-/adm-zip-0.5.16.tgz` | `apps/web` direct `devDependencies` | utility tooling | no |
| `jsdom@24.1.3` | `https://registry.npmjs.org/jsdom/-/jsdom-24.1.3.tgz` | `apps/web` direct `devDependencies` | test runtime environment | **yes (irreducible)** |

## Product verification blockers

- None identified yet; product assertions have not run because test-runtime dependencies remain unavailable.

# Fixes Applied

- Added deterministic local workspace stubs for `@bookiji-inc/*` packages under `packages/{ai-core,ai-runtime,error-contract,observability,persistent-memory-runtime,platform-auth,stripe-runtime}`.
- Updated workspace wiring (`pnpm-workspace.yaml`, `tsconfig.json`, `apps/web/vitest.config.ts`) so local stubs are first-class resolution targets for tests/build.
- Reclassified current status from execution `Failed` to `Pending (blocked by environment)` to avoid marking feature behavior as failed before assertions run.

# Verification Notes

- Execution order remains: Authentication → Layout / Navigation → Help Center → History.
- Irreducible prerequisite to execute Wave 1 in this environment: outbound access to `registry.npmjs.org` for at least `jsdom` + testing-library packages (or an internal mirror providing those exact artifacts).
