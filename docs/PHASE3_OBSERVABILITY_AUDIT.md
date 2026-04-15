# Phase 3 — Observability audit

**Last updated:** 2026-04-10  
**Guardrail:** Wave 2 web **closed**; recommendations here are **non-blocking** unless tied to a production incident.

## Shared wrapper

[`api/_lib/observability.ts`](../api/_lib/observability.ts) re-exports:

- `logApiEvent(level, event, fields)` → `emitStructuredLog` from `@bookiji-inc/observability`
- `logAiEvent` → `emitAiLog`
- `getObservedRequestId(source)` → `getRequestId` from the same package

Runtime behavior of sinks (stdout, forwarding, dashboards) is owned by **`@bookiji-inc/observability`** and deployment env — not duplicated here.

## Request ID propagation

| Mechanism | Where |
|-----------|--------|
| `getApiRequestId` / header read | [`api/_lib/ai/error-contract.ts`](../api/_lib/ai/error-contract.ts) — reads `x-request-id` / `X-Request-Id` / `X-Request-ID`. |
| `getObservedRequestId` | Used in `ai-chat`, `ai-coach`, `admlog` catch paths for `logApiEvent` fields. |
| `sendApiError(..., { source: req.headers })` | Passes headers into `getApiRequestId` so error JSON includes **`requestId`** when derivable. |

**Gap:** Handlers that return **raw `res.json({ error, message })`** (notably billing checkout) may omit **`requestId`** on those branches — aligns with error-contract rollout **P0** in [`PHASE3_ERROR_CONTRACT_ROLLOUT.md`](PHASE3_ERROR_CONTRACT_ROLLOUT.md).

## Logging coverage (API routes)

| Area | Pattern | Gap |
|------|---------|-----|
| Strava OAuth / refresh | `logApiEvent` on failures and missing config | OK |
| Withings | `logApiEvent` on exchange/refresh failures | OK |
| AI chat / coach | `logApiEvent` on thrown errors with `requestId` | OK |
| Billing checkout | `logApiEvent` on auth failure + checkout catch | Missing structured event on some early validation branches (optional improvement). |
| Support queue / KB | Errors returned via `sendApiError` — no per-event `logApiEvent` on every 503 (acceptable; details in JSON). | Optional: add warn on 503 for ops dashboards. |
| `escalationNotify` | **`console.warn`** for rate-limit, Slack non-OK, fetch errors | **Inconsistent** with `logApiEvent`; P2 to align. |

## Metrics

No first-party **metrics** hooks (counters/histograms) were found in `api/_lib` beyond structured log emitters. Any platform metrics would live inside `@bookiji-inc/observability` or external log drains.

**Non-blocking recommendation:** If Vercel log drains or APM are added later, standardize on **`event`** names already used (`kinetix_*`, `kinetix_ai_*`, `kinetix_strava_*`, etc.).

## References

- [`HELP_CENTER_OPERATIONS.md`](HELP_CENTER_OPERATIONS.md) — operator-facing behavior; not a logging spec.
- [`PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) — observability **Partial** row points here for Phase 3 follow-up.
