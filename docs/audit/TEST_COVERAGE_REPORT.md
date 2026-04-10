# Test coverage report

## Commands run (evidence)

| Layer | Command | Result |
|-------|---------|--------|
| Unit + integration (Vitest) | `pnpm exec vitest run` in `apps/web` | **81 files, 353 tests passed** |
| E2E (Playwright) | `pnpm exec playwright test` in `apps/web` (after `pnpm exec playwright install chromium`) | **38 tests passed** |
| Lint | `pnpm lint` (root) | **pass** |
| Type-check | Included in CI patterns; `apps/web` has `pnpm type-check` | Not re-run separately after final edits; recommend CI gate |

## Inventory

### Web (`apps/web`)

- **Vitest:** Broad coverage under `src/**/*.test.ts(x)`, `src/integration/*.integration.test.tsx`, `src/test/*.test.ts`, plus `api/_lib/**/*.test.ts` pulled into web’s Vitest config.
- **Playwright:** `e2e/*.spec.ts` — shell, charts, help center a11y, internal links, operator/support queue smoke, AI chat smoke, **audit crawl** (`kinetix-audit-crawl.spec.ts`).

### Core (`packages/core`)

- **Vitest:** `src/chatMath/chatMath.test.ts` (included in root `pnpm test`).

### API (`api/`)

- Tests co-located under `api/_lib/**/*.test.ts` executed via `apps/web` Vitest.

## Gaps and risks

| Gap | Risk | Suggestion |
|-----|------|------------|
| No Istanbul/c8 coverage gate in this run | Unknown line coverage % | Add `vitest --coverage` with threshold in CI |
| E2E does not cover every user gesture on Run dashboard | Regression risk on GPS/modals | Add focused Playwright flows for start/stop/pause if product priority |
| Native apps | Zero automated UI in this audit | Xcode UI tests or snapshot tests on Watch/iPhone |
| API handlers | Many paths rely on integration tests + manual deploy | Contract tests hitting staging `/api/*` |

## New tests added in this audit

- `apps/web/e2e/kinetix-audit-crawl.spec.ts` — route sweep, axe JSON, screenshots, console capture, primary nav crawl.
- `internal-links-crawl.spec.ts` updated to include `/coaching`.
