# OpsAI Control Plane

This control plane surfaces the OpsAI autonomy, Sentry integration, and simulation harness built in the `web/src/ops` workspace.

## Panels
- **Autonomy Panel**: shows whether OpsAI autonomy is enabled, what level is configured, recent/last evaluated actions, and offers a manual "Evaluate now" trigger.
- **Sentry Panel**: highlights incidents and deployments that originated from Sentry webhooks so responders can filter by source.
- **Simulation Panel**: lets operators preview or run synthetic outage scenarios and see the actions OpsAI would perform under current policy.

## Webhooks & Configuration
- Configure Sentry webhooks to the following endpoints (mirrored by handler modules):
  - `/api/ops/controlplane/hooks/sentry/issue`
  - `/api/ops/controlplane/hooks/sentry/performance`
  - `/api/ops/controlplane/hooks/sentry/deploy`
  - `/api/ops/controlplane/hooks/sentry/alert`
- Environment variables:
  - `OPSAI_AUTONOMY_ENABLED` (`true` | `false`)
  - `OPSAI_AUTONOMY_LEVEL` (`observing` | `advisory` | `limited` | `full`)
  - `SENTRY_DSN` (optional)
  - `SENTRY_WEBHOOK_SECRET` (optional)

## Recommended workflow
1. Choose a simulation in the Simulation Panel and preview it.
2. Inspect the predicted OpsAI actions in the Autonomy Panel.
3. Adjust policy levels or disable risky actions as needed.
4. Enable limited/full autonomy and repeat testing until comfortable.
