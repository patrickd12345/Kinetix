# Kinetix Local Verification Baseline

Last updated: 2026-04-27

## Environment

- Node.js: `v22.14.0`
- pnpm: `10.30.3`
- Corepack: `0.31.0`

## Install Baseline

- Command: `pnpm install --no-frozen-lockfile`
- Result: Success (lockfile up to date; dependencies already installed)

## Wave 1 Test Baseline

- Workspace: `@kinetix/web`
- Test surfaces: Authentication / Access, Layout / Navigation, Help Center, History
- Execution mode: deterministic rerun until pass or irreducible blocker
- Final status: PASS
- Final result: `Test Files 6 passed (6)`, `Tests 17 passed (17)`

## Wave 2 Test Baseline (scope closure)

- Workspace: `@kinetix/web`
- Command: `pnpm --filter @kinetix/web test` (includes `build:bookiji-packages`, `pnpm --filter @kinetix/core build`, `vitest run`)
- Final status: PASS (recorded 2026-04-10)
- Final result: `Test Files 79 passed (79)`, `Tests 346 passed (346)`

## Current `@kinetix/web` Vitest snapshot (informative)

Authoritative counts are always from a fresh **`pnpm --filter @kinetix/web test`** on `main` (or your branch). Representative run **2026-04-27**: **`Test Files 106 passed (106)`**, **`Tests 476 passed (476)`**. This does **not** replace the Wave 2 closure numbers above; it documents drift as tests and API-in-web coverage grew.

## Repo quality gates (Wave 2)

- `pnpm lint`: PASS (2026-04-10)
- `pnpm type-check`: PASS (2026-04-10)
- `pnpm run verify:vercel-parity`: **PASS** (2026-04-10)
  - Command: `pnpm run verify:vercel-parity` (from repo root `products/Kinetix`; see `scripts/verify-vercel-parity.mjs`)
  - Success marker: final line `[verify-vercel-parity] OK`
  - Scope: `check-no-local-ai-core`, `scripts/vercel-install.sh`, root `pnpm type-check`, `pnpm lint`, `pnpm run build` (includes `@kinetix/web` production build), then `products/bookiji` Vercel-like install + production build via `scripts/verify-bookiji-vercel-build.mjs`
  - **Re-run** this gate before shipping after any change to `scripts/vercel-install.sh`, workspace wiring, or `@bookiji-inc/*` consumption paths (long-running; allow several minutes)

## Phase 4 ? Playwright (optional / release readiness)

- Command: `pnpm test:e2e` (from repo root; runs `apps/web` Playwright + local Vite `webServer`)
- Final status: **PASS** (recorded 2026-04-10)
- Final result: **18 passed** (Chromium project)
