# UI crawl report — Kinetix web (`apps/web`)

## Scope and method

- **Tooling:** Playwright (Chromium), `@axe-core/playwright` for automated a11y scans per route.
- **Auth / gates:** `VITE_SKIP_AUTH=1` + `VITE_MASTER_ACCESS=1` in `apps/web/playwright.config.ts` webServer env so the SPA mounts all protected routes without Supabase-backed entitlement checks (see `src/lib/debug/masterAccess.ts`).
- **Evidence:** `pnpm exec playwright install chromium` then `pnpm exec playwright test` from `apps/web` — **38 passed** (includes new `e2e/kinetix-audit-crawl.spec.ts`).

## Routes exercised (pathname)

From `src/App.tsx`, every listed route was loaded with `waitUntil: 'domcontentloaded'`, full-page screenshot captured in test output, axe run recorded as JSON attachment pattern `axe-<slug>.json`, and console warning/error capture attached when non-empty.

| Route | Notes |
|-------|--------|
| `/` | Run dashboard shell |
| `/history` | History |
| `/coaching` | Coaching hub |
| `/weight-history` | Weight |
| `/menu` | Charts |
| `/chat` | Coach chat |
| `/settings` | Settings |
| `/help` | Help Center |
| `/operator` | Operator dashboard (feature flags forced on via master access) |
| `/support-queue` | Support queue UI |
| `/login` | Login (reachable while skip-auth is on — still renders route) |
| `/billing/success`, `/billing/cancel` | Billing return shells |

## Navigation sweep

- **Primary sidebar:** Test `primary navigation visits every shell route without login redirect` clicks each **Primary navigation** link (desktop viewport 1280×800): Run, History, Coaching, Weight, Charts, Chat, Help, Operator, Queue, Settings — asserts URL does not redirect to `/login`.

## Internal link hygiene

- **`e2e/internal-links-crawl.spec.ts`:** For each crawl origin route, all `a[href]` same-origin paths must be in the allowlist (includes `/coaching` after this audit).

## Console / runtime errors

- Listeners record `console` types `warning` and `error`, plus `pageerror`. Attachments named `console-<slug>.txt` when non-empty.

## Limitations (explicit)

- **Not every clickable element** was clicked exhaustively (buttons, modals, form submits across all pages). The suite covers **all primary routes** and **primary nav**; deep interaction matrices (e.g. every modal on Run dashboard) are **not** fully automated here.
- **Native iOS/watchOS** UIs were not crawled.
- **Production-only** behavior (real Supabase, real entitlements, real `/api/*` on Vercel) differs from local Vite; see `SYSTEM_MAP.md`.

## Master access

Temporary full UI access for crawls uses **`VITE_MASTER_ACCESS`** (client) and server-side **`KINETIX_MASTER_ACCESS`** only where API operator bypass is needed for CI — see `KINETIX_REMEDIATION_PLAN.md`.
