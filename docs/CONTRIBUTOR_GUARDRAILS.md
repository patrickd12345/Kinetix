# Contributor Guardrails

- This repository contains parallel generations (active surfaces plus legacy/migration references).
- Contributors must verify the live deployment target before changing web architecture or deployment wiring.
- Do **not** assume `apps/web` is production only because it is in the workspace; confirm with deployment config.
- Do **not** assume `web/` is dead only because it is outside the workspace; confirm what is actually deployed.
- Production-preserving rule: no deployment target switch in incidental PRs.
- Shared scoring logic should converge into one canonical package over time, but that convergence is out of scope for this task.
