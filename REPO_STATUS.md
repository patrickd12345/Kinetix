# Kinetix Repo Status

## Canonical Surfaces
- Production web: `apps/web/` (Vite + React workspace app, package `@kinetix/web`).
- Secondary web: `archive/web-legacy/` (legacy reference only; not workspace-wired for active deploys).
- iPhone: `ios/KinetixPhone/`.
- Apple Watch: `watchos/KinetixWatch/` (with host/companion targets in `watchos/`).
- Shared core: `packages/core/` (package `@kinetix/core`).

## Deployment Truth
- Web login follows the Bookiji Inc identity standard: magic link primary, optional OAuth buttons only when `VITE_AUTH_*_ENABLED` is set; no end-user password sign-in on the login screen.
- Optional `VITE_AUTH_REDIRECT_URL` (or `NEXT_PUBLIC_AUTH_REDIRECT_URL`) pins magic-link/OAuth return URLs to the Kinetix origin (e.g. `https://kinetix.bookiji.com/login`) when login is initiated from another Bookiji host; see [`docs/deployment/ENV_PARITY.md`](docs/deployment/ENV_PARITY.md).
- Current deployed app for kinetix.bookiji.com: `apps/web/`.
- Evidence:
  - Root `vercel.json` builds `@kinetix/web` and publishes `apps/web/dist`.
  - Root scripts (`build`, `dev:web`, `test:e2e`) target `@kinetix/web`.
  - Workspace includes `apps/*` and `packages/*`; no active `web/` package path.
  - Deployment docs reference `apps/web` as the web client path for production checks.
- Confidence: High (repo config and deployment docs are aligned).

## Working Rules
- New production web changes go in: `apps/web/`.
- Do not add new production features in: `archive/web-legacy/` (or any ad-hoc `web/` copy).
- Shared logic belongs in: `packages/core/` (and existing shared `@bookiji-inc/*` packages where applicable).
- Native Apple changes go in: `ios/KinetixPhone/` and `watchos/KinetixWatch/` (+ related watch host targets).

## Legacy / Migration Notes
- `web/`: No active top-level `web/` app is present in this repo snapshot; treat this path as non-canonical.
- `apps/web/`: Active production web surface and canonical destination for live web work.
- `packages/core/`: Active shared scoring/math/runtime utilities consumed by the web app (and potentially native parity work).
- `ios/`: Active Apple-native surface for iPhone companion features.
- `watchos/`: Active Apple-native surface for watch coaching/tracking runtime.

## Project plan

Strategic phases and backlog live in [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) (stub: [`PROJECT_PLAN.md`](PROJECT_PLAN.md)). Use [`REPO_STATUS.md`](REPO_STATUS.md) (this file) for *where* to implement; use the plan doc for *what* is next.

## Release candidate verification (Help Center operator)

**Status:** Phase-3C operator surfaces (`/operator`, `/support-queue`: flags, SLA badges, URL filters, escalation ordering, hardened Slack notification path with process-local resend suppression + rate-limit safety) are treated as **RC-ready** in-repo: lint, type-check, Vitest (see single-fork command in doc), and `pnpm test:e2e:operator` are green per [`docs/HELP_CENTER_OPERATIONS.md`](docs/HELP_CENTER_OPERATIONS.md) (Verification section).

**Before production:** still required: manual operator pass with `pnpm dev`, real sign-in, and `/operator` + `/support-queue` against live API and DB (same doc).

## Accessibility (web)

- **Standard:** [`docs/standards/ACCESSIBILITY_STANDARD.md`](docs/standards/ACCESSIBILITY_STANDARD.md) (WCAG 2.2 AA-oriented; in-repo pointer + audit cross-link).
- **Kinetix web audit + remediation log:** [`docs/ACCESSIBILITY_AUDIT_KINETIX_WEB.md`](docs/ACCESSIBILITY_AUDIT_KINETIX_WEB.md) (severity-ranked findings, shared shell/dialog/route fixes).

## LLM coach math (deterministic)

- Architecture: [`docs/architecture/LLM_MATH_GUARDRAILS.md`](docs/architecture/LLM_MATH_GUARDRAILS.md).
- Implementation: `@kinetix/core` `chatMath/*`, `api/_lib/ai/chatMathGate.ts`, `api/_lib/ai/requestHandlers.ts` (math-bearing prompts get verified numbers server-side; fail-closed when inputs are ambiguous).

## Immediate Next-Step Guidance
- If working on the live web product: change `apps/web/` first, validate build/test from workspace scripts, and keep Vercel wiring intact.
- Help Center surfaces: routes **`/help`** and **`/support-queue`**; implementation in `apps/web/src/pages/HelpCenter.tsx` and `apps/web/src/pages/SupportQueue.tsx`; contract and operator docs in `apps/web/HELP_CENTER*.md` and `docs/HELP_CENTER_OPERATIONS.md`. Operator queue API adds assignment + SLA fields, derived triage labels, and list `summary` counts (`api/_lib/supportQueueStore.ts`, `api/support-queue/tickets/[[...segments]].ts`).
- If porting legacy functionality: use `archive/web-legacy/` as migration source only, then implement in `apps/web/`.
- If changing shared scoring/math: update `packages/core/`, then run dependent app checks before merge.
- If working on Apple-native coaching/tracking: change `ios/` and/or `watchos/` targets directly; do not couple incidental native work to web deployment rewiring.
