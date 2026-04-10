# Phase 3 — CI audit

**Last updated:** 2026-04-10  
**Workflow:** [`.github/workflows/web-ci.yml`](../.github/workflows/web-ci.yml)

## What runs today

| Step | Command / behavior |
|------|---------------------|
| Trigger | `push` / `pull_request` with **path filters** (see below). |
| Job | Single job `vercel-parity` on `ubuntu-latest`, Node **22**, pnpm **10.30.3**. |
| Gate | `node scripts/verify-vercel-parity.mjs` — documented as matching Vercel install + type-check + lint + build (see script for exact steps). |

## Path filters (what qualifies for CI)

Included paths:

- `apps/web/**`
- `packages/core/**`
- `api/**`
- `scripts/**`
- `vercel.json`, root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `.github/workflows/web-ci.yml`
- `scripts/verify-vercel-parity.mjs`

**Not included:** `apps/rag/**`, `ios/**`, `watchos/**`, `supabase/**`, product docs-only changes.

## Gaps (non-blocking extensions)

| Gap | Risk | Optional extension |
|-----|------|---------------------|
| **RAG app** changes do not trigger web CI | Medium if RAG shares types or scripts with root workspace | Add `apps/rag/**` to path filters **or** a separate lightweight workflow (`pnpm --filter @kinetix/rag test` / lint if defined). |
| **Vitest / Playwright** not in GitHub Actions | Release confidence relies on local/ops runs | Add scheduled or manual jobs: `pnpm --filter @kinetix/web test`, `pnpm test:e2e` with secrets/service containers as needed — **explicitly non-blocking** for Wave 2 closure evidence (Vitest already recorded in [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md)). |
| **API-only** TypeScript | Root `type-check` includes workspace per parity script | Keep monitoring `verify-vercel-parity.mjs` when `api/` or shared packages change. |

## Parity gate behavior

`pnpm run verify:vercel-parity` is the **same** command as CI’s node script — last **PASS** recorded **2026-04-10** in [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md).

## References

- [`PHASE4_E2E_PLAN.md`](PHASE4_E2E_PLAN.md) — Playwright scope outside CI.
- [`PROJECT_PLAN.md`](PROJECT_PLAN.md) — regression note to re-run parity after install script or `@bookiji-inc/*` changes.
