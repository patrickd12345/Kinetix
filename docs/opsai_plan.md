# OpsAI Integration Plan

- Add TypeScript + Vitest support within `web` workspace to host OpsAI modules and tests.
- Implement autonomous actions module (`src/ops/autonomy`) with policy, actions, engine, and shared types.
- Introduce Sentry integration module (`src/ops/sentry`) with webhook parsers, mappers, and types.
- Add simulation harness (`src/ops/sim`) to generate synthetic ops states and connect with autonomy engine.
- Provide lightweight control-plane API handlers under `src/api/ops/controlplane` for autonomy, Sentry hooks, and simulation.
- Build React control plane panels (`src/components/opsai-control-plane`) for autonomy status, Sentry surfacing, and simulation workflows.
- Wire autonomy evaluations to react to simulation runs and Sentry webhook handlers.
- Extend README/config docs to describe autonomy, Sentry, and simulation setup and environment variables.
- Add npm scripts and Vitest suites for autonomy policy/engine, Sentry mapping, and simulation scenarios.
- Keep logging, safety gates, and reversible metadata in place for autonomous actions.
