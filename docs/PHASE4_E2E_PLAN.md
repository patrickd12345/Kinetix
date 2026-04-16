# Phase 4 — E2E plan (Playwright)

**Last updated:** 2026-04-10  
**Location:** `apps/web/e2e/*.spec.ts` (run via `pnpm --filter @kinetix/web test:e2e` from repo root, or `pnpm test:e2e`).  
**Status:** **Non-blocking** for Wave 2 closure evidence — Vitest baseline remains authoritative per [`KINETIX_SCOPE_CLOSURE.md`](KINETIX_SCOPE_CLOSURE.md).

## Inventory (current specs)

| File | Focus |
|------|--------|
| `e2e/ai-chat-smoke.spec.ts` | AI chat surface smoke |
| `e2e/charts.spec.ts` | Charts / menu charts |
| `e2e/internal-links-crawl.spec.ts` | Internal link integrity |
| `e2e/operator-support-queue-smoke.spec.ts` | Operator / support queue (also exposed as `pnpm test:e2e:operator` in `apps/web/package.json`) |
| `e2e/shell-dashboard.spec.ts` | Shell / dashboard load |

Config: `apps/web/playwright.config.ts`.

## Suggested priority order (release readiness)

1. **`shell-dashboard.spec.ts`** — fast sanity that the app shell renders.
2. **`internal-links-crawl.spec.ts`** — broad navigation regression.
3. **`operator-support-queue-smoke.spec.ts`** — operator flows (requires env/backend; may skip in CI without secrets).
4. **`ai-chat-smoke.spec.ts`** — depends on AI gateway/Ollama availability; treat as **optional** in CI.
5. **`charts.spec.ts`** — visualization / display regression (align with display-error policy when fixing UI bugs).

## CI note

GitHub Actions **web-ci** currently runs **Vercel parity only** — see [`PHASE3_CI_AUDIT.md`](PHASE3_CI_AUDIT.md). Adding Playwright to CI is an **optional** Phase 3/4 hardening step (artifacts, base URL, auth).

## Non-blocking declaration

Failures in E2E due to **missing AI keys**, **RAG not running**, or **preview data** do not reopen Wave 2 — file issues and run with documented env or skip lists.

## References

- [`PHASE4_DEPLOYMENT_CHECKLIST.md`](PHASE4_DEPLOYMENT_CHECKLIST.md)
