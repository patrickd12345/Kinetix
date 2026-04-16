# Phase 3 — Error contract rollout (audit)

**Last updated:** 2026-04-10  
**Scope:** Vercel serverless handlers under repo-root `api/` (not `apps/web/src/pages/api`; this repo is Vite + `api/*`).  
**Guardrail:** Wave 2 web remains **closed**; this document tracks **audit** and **priority** only — no scope reopen.

## Shared primitives

| Module | Role |
|--------|------|
| [`api/_lib/apiError.ts`](../api/_lib/apiError.ts) | `sendApiError(res, status, message, { code?, details?, source? })` — merges `buildError` from `@bookiji-inc/error-contract` with **`error`** set to the human `message` string (top-level `error` duplicates the message for HTTP consumers). Request id via `getApiRequestId` from headers/`source`. |
| [`api/_lib/ai/error-contract.ts`](../api/_lib/ai/error-contract.ts) | `serializeApiError`, `toApiHttpError`, `buildKinetixApiError`, `getApiRequestId` — canonical **`code` / `message` / `requestId` / `details`** shape from `@bookiji-inc/error-contract`. |

## Coverage by handler (entry files)

Excludes `api/_lib/**` (shared). One row per deployed entry file (catch-all segments count as one function each).

| Handler | Primary pattern | Notes / mixed shapes |
|---------|-----------------|----------------------|
| `api/escalationNotify.ts` | `sendApiError` for 4xx | Success paths **`204`** no body; rate-limit / Slack failure **`console.warn`** (not `logApiEvent`). |
| `api/admlog/index.ts` | `sendApiError` + `buildKinetixApiError` | When disabled: **`403`** JSON `{ error, ...payload, criteria, howToEnable }` — extra fields beyond canonical error body. |
| `api/ai-chat/index.ts` | `serializeApiError` | CORS/method rejects: **`{ code, message }`** only (no `requestId` on those fast paths). Success/error paths from handlers use serialized canonical errors. |
| `api/ai-coach/index.ts` | Same as `ai-chat` | Same CORS/method shape vs serialized body split. |
| `api/billing/create-checkout-session/index.ts` | **Mixed** | Uses `sendApiError` for some paths; many responses are raw **`{ error: string, message: string }`** (e.g. `billing_unavailable`, `unauthorized`, `missing_parameters`, `checkout_failed`) **without** `sendApiError` / `requestId`. |
| `api/strava-oauth/index.ts` | `sendApiError` | Uniform on this route. |
| `api/strava-proxy/index.ts` | `sendApiError` + **passthrough** | Strava JSON errors forwarded **`res.status(...).json(errorData)`** — upstream shape, not Kinetix canonical. |
| `api/strava-refresh/index.ts` | `sendApiError` | Uniform. |
| `api/support-queue/kb-approval/[[...segments]].ts` | `sendApiError` | Success wrappers `{ ok: true, ... }`; errors via `sendApiError`. |
| `api/support-queue/tickets/[[...segments]].ts` | `sendApiError` | Same. |
| `api/withings/index.ts` | `sendApiError` | Uniform. |

## Non-uniformity summary

1. **Billing (`create-checkout-session`)** — highest drift: string **`error`** codes (`billing_unavailable`, `unauthorized`, …) alongside **`message`**, no guaranteed **`requestId`** on those branches (contrast with `sendApiError`).
2. **AI routes (`ai-chat`, `ai-coach`)** — early CORS/method responses use **`code` + `message`** only; success path and handler errors use **`serializeApiError`** (aligned with `@bookiji-inc/error-contract`).
3. **Strava proxy** — transparent forward of Strava JSON on non-OK JSON responses; intentional but **not** the same schema as `buildError`.
4. **Escalation notify** — structured logging not used on all paths (`console.warn`); see [`PHASE3_OBSERVABILITY_AUDIT.md`](PHASE3_OBSERVABILITY_AUDIT.md).

## Priority classes (rollout)

| Class | Items | Rationale |
|-------|--------|-----------|
| **P0** | Billing checkout error JSON + auth/validation branches | User-visible payment flow; clients may branch on shape inconsistently vs other APIs. |
| **P1** | AI CORS/method rejects — align with `serializeApiError` or document as intentional minimal responses | Low volume but confusing for generic API clients. |
| **P1** | Strava proxy passthrough — document contract or wrap known cases | Third-party shape by design; risk is support/debug confusion. |
| **P2** | `escalationNotify` logging parity (`logApiEvent` vs `console`) | Operational consistency; not a JSON contract issue. |
| **P2** | Admlog 403 extension fields | Dev-only route; document as special case. |

## Tests / evidence pointers

- Web Vitest: `apps/web/src/test/ai-route-errors.test.ts` (referenced in [`KINETIX_SCOPE_CLOSURE.md`](KINETIX_SCOPE_CLOSURE.md)).
- API libs: `api/_lib/**/*.test.ts` (support, Withings, AI guardrails).

## References

- [`PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) — platform **Error contract** row.
- Package: `@bookiji-inc/error-contract` (shared with Bookiji spine).
