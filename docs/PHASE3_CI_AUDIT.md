# Phase 3 — CI audit

**Last updated:** 2026-04-11  
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

## Native (iOS / watchOS)

- Manual audit runbook: [`docs/audit/KINETIX_NATIVE_AUDIT_RUNBOOK.md`](audit/KINETIX_NATIVE_AUDIT_RUNBOOK.md)
- Placeholder workflow (no Xcode build): [`.github/workflows/native-ci-placeholder.yml`](../.github/workflows/native-ci-placeholder.yml)
- Web CI still does not compile native targets; use the runbook before RCs that touch `ios/**` or `watchos/**`.

## Lighthouse CI

- Config: [`lighthouserc.json`](../lighthouserc.json) (placeholder URL; override via CLI in CI).
- Manual workflow: [`.github/workflows/lighthouse-ci.yml`](../.github/workflows/lighthouse-ci.yml) — run with a deployed/preview `target_url`.

## Vitest coverage

- CI job `vitest-coverage` in [`web-ci.yml`](../.github/workflows/web-ci.yml) runs `pnpm --filter @kinetix/web test:coverage` after the same install path as Vercel parity.

## Gaps (non-blocking extensions)

| Gap | Risk | Optional extension |
|-----|------|---------------------|
| **RAG app** changes do not trigger web CI | Medium if RAG shares types or scripts with root workspace | Add `apps/rag/**` to path filters **or** a separate lightweight workflow (`pnpm --filter @kinetix/rag test` / lint if defined). |
| **Vitest / Playwright** not in GitHub Actions | Release confidence relies on local/ops runs | **Vitest coverage** is now in `web-ci.yml`. Playwright remains local/optional unless a dedicated workflow is added with secrets and a stable server harness. |
| **API-only** TypeScript | Root `type-check` includes workspace per parity script | Keep monitoring `verify-vercel-parity.mjs` when `api/` or shared packages change. |

## Parity gate behavior

`pnpm run verify:vercel-parity` is the **same** command as CI’s node script — last **PASS** recorded **2026-04-10** in [`KINETIX_LOCAL_VERIFICATION_BASELINE.md`](KINETIX_LOCAL_VERIFICATION_BASELINE.md).

## References

- [`PHASE4_E2E_PLAN.md`](PHASE4_E2E_PLAN.md) — Playwright scope outside CI.
- [`PROJECT_PLAN.md`](PROJECT_PLAN.md) — regression note to re-run parity after install script or `@bookiji-inc/*` changes.
