# Kinetix Test Coverage Report

Audit date: 2026-04-11

## Commands Executed

| Command | Result |
|---|---|
| `pnpm --filter @kinetix/web type-check` | Pass. |
| `pnpm --filter @kinetix/core test` | Pass, 1 file, 5 tests. |
| `pnpm type-check` | Pass. |
| `pnpm --filter @kinetix/web build` | Pass, with chunk/lazy import warnings. |
| `pnpm --filter @kinetix/web exec vitest run src/lib` | Pass, 45 files, 224 tests. |
| `pnpm --filter @kinetix/web exec vitest run src/components` | Pass, 5 files, 18 tests. |
| `pnpm --filter @kinetix/web exec vitest run src/pages` | Pass, 3 files, 9 tests. |
| `pnpm --filter @kinetix/web exec vitest run src/integration` | Pass, 9 files, 28 tests. |
| `pnpm --filter @kinetix/web exec vitest run src/test` | Pass, 4 files, 17 tests. |
| `pnpm --filter @kinetix/web exec vitest run src/hooks src/context src/store` | Pass, 7 files, 21 tests. |
| `pnpm exec vitest run ../../api` from `apps/web` | Pass, 9 files, 39 tests. |
| `pnpm --filter @kinetix/rag test` | Pass, 41 node tests. |
| `pnpm --filter @bookiji-inc/ai-core test` | Pass, 2 tests. |
| `pnpm --filter @bookiji-inc/ai-runtime test` | Pass, 9 tests. |
| `pnpm --filter @bookiji-inc/error-contract test` | Pass, 9 tests. |
| `pnpm --filter @bookiji-inc/observability test` | Pass, 3 tests. |
| `pnpm --filter @bookiji-inc/persistent-memory-runtime test` | Pass, 2 tests. |
| `pnpm --filter @bookiji-inc/platform-auth test` | Pass, 6 tests. |
| `pnpm --filter @bookiji-inc/stripe-runtime test` | Pass, 6 tests. |
| `pnpm --filter @kinetix/web test:e2e` | Pass, 43 Playwright tests. |
| `pnpm --filter @kinetix/web test:coverage` | Pass, 82 files, 356 tests; overall statements 42.56%, branches 69.25%, funcs 51.77%, lines 42.56%. |
| Prior `pnpm --filter @kinetix/web test:vitest:serial` | Timed out after about 124 seconds with no useful test summary. |
| `pnpm lh:ci` | Fail/blocker: config points at `https://example.invalid/lighthouse-placeholder`. |

## Test Inventory

Static inventory found 112 test/spec files across web, API, RAG, core, and shared packages:
- Web Vitest/API-in-web config: 82 executed by coverage.
- Playwright E2E: 10 spec files, 43 executed tests.
- API tests: 9 files executed through `apps/web` Vitest config.
- RAG node tests: 7 service test files, 41 node subtests.
- Core package: 1 test file.
- Shared package tests: 8 test files across AI, auth, observability, memory, error, and Stripe runtimes.

## Coverage Gaps

| ID | Severity | Evidence | Gap |
|---|---|---|---|
| TEST-01 | P1 | Coverage report: `Settings.tsx` 0.13% statements, 0 funcs. | The highest-risk integration/import screen has almost no unit/component coverage. |
| TEST-02 | P1 | Coverage report: `RunDashboard.tsx` 0.33%, `run-dashboard/RunDashboardPanels.tsx` 2.46%, `RunDashboardModals.tsx` 12.97%. | Core run workflow depends mostly on E2E smoke. |
| TEST-03 | P1 | Coverage report: `store/runStore.ts` 17.68%, 0 funcs. | Live run start/pause/resume/stop/save logic is weakly tested. |
| TEST-04 | P2 | Coverage report: `WeightHistory.tsx` 2.32%. | Weight pagination and empty/error states lack component coverage. |
| TEST-05 | P2 | Coverage report: overall 42.56% statements. | Broad coverage exists for engines but not route-level UI/state. |
| TEST-06 | P2 | First serial web Vitest run timed out at 124 seconds; split and coverage runs pass. | The serial helper is unreliable or too slow for default audit use. |
| TEST-07 | P3 | Passing tests emit React uncaught error stacks and Dexie missing-API stacks. | Noise reduces signal in CI logs. |

## Flaky/Slow Tests

- `withingsOAuthServer.test.ts`: retry-path tests take about 8 seconds, with one 503 retry test about 7 seconds.
- `help-center-support.integration.test.tsx`: about 2-3 seconds in full/coverage runs.
- Serial web Vitest helper timed out once; split runs and coverage completed.

## Missing Or Weak Areas

- No dedicated component/unit tests for Settings import flows, Garmin ZIP errors, Strava auth refresh UI, manual Withings expanded sync UI, or outlier cleanup dialog beyond targeted integration pieces.
- No deterministic runStore tests for duration math, geolocation update behavior, PB update side effects, RAG indexing after save, or save failure display.
- E2E covers every route but primarily validates load/axe/smoke behavior, not every empty/error/heavy state.
- Lighthouse CI exists but is not wired to a real app URL.
