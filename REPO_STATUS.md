# Kinetix Repo Status

## Canonical Surfaces
- Production web: `apps/web/` (Vite + React workspace app, package `@kinetix/web`).
- Secondary web: `archive/web-legacy/` (legacy reference only; not workspace-wired for active deploys).
- iPhone: `ios/KinetixPhone/`.
- Apple Watch: `watchos/KinetixWatch/` (with host/companion targets in `watchos/`).
- Shared core: `packages/core/` (package `@kinetix/core`).

## Deployment Truth
- Web login follows the Bookiji Inc identity standard: magic link primary, optional OAuth buttons only when `VITE_AUTH_*_ENABLED` is set; no end-user password sign-in on the login screen.
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

## Immediate Next-Step Guidance
- If working on the live web product: change `apps/web/` first, validate build/test from workspace scripts, and keep Vercel wiring intact.
- Help Center surfaces live in `apps/web/src/pages/HelpCenter.tsx` and `apps/web/src/pages/SupportQueue.tsx`; contract and operator docs live in `apps/web/HELP_CENTER*.md` and `docs/HELP_CENTER_OPERATIONS.md`.
- If porting legacy functionality: use `archive/web-legacy/` as migration source only, then implement in `apps/web/`.
- If changing shared scoring/math: update `packages/core/`, then run dependent app checks before merge.
- If working on Apple-native coaching/tracking: change `ios/` and/or `watchos/` targets directly; do not couple incidental native work to web deployment rewiring.
