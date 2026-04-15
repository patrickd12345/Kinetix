# Kinetix Edge Case Report

Audit date: 2026-04-11

## Executed Edge Scenarios

| Scenario | Evidence | Result |
|---|---|---|
| Empty/local mocked account | Playwright audit crawl with `VITE_SKIP_AUTH=1` and `VITE_MASTER_ACCESS=1`. | All routes loaded. |
| Mobile shell overflow | `shell-dashboard.spec.ts`. | Passed. |
| Charts desktop/mobile | `charts.spec.ts`. | Passed. |
| Help support search unresolved/escalation | E2E and integration tests. | Passed. |
| RAG unavailable fallback | RAG client/API tests and static code. | Fallback exists; UX disclosure depends on repeated startup failure banner. |
| Withings partial failure | `withings/sync.test.ts`. | Passed. |
| Strava zero distance/duration | `strava.test.ts`. | Passed. |
| API unauthorized/method errors | AI route and support/RAG tests. | Passed for tested handlers. |
| AI malformed JSON | Static review of `useAICoach.ts`. | Fallback exists but weak. |
| Large history | Static review only. | Not fully executed with generated heavy dataset. |
| Live SSO/OAuth | No staging URL/test account. | Blocked. |
| Lighthouse performance | Placeholder URL. | Blocked. |

## Findings

| ID | Severity | Evidence | Finding |
|---|---|---|---|
| EDGE-01 | P1 | Heavy account scenario was not executed with generated large IndexedDB data. | Heavy-user performance and chart/history behavior are only statically assessed. |
| EDGE-02 | P2 | Live smoke blocked by missing staging URL/test account. | Real auth/OAuth/entitlement/provider behavior remains unverified. |
| EDGE-03 | P2 | `strava.ts` 60s sleep on rate limit. | Slow network/rate-limit path can appear frozen. |
| EDGE-04 | P2 | `RunDashboard`/`Settings`/`WeightHistory` low coverage. | Empty/error/loading states on key screens are not fully locked. |
| EDGE-05 | P3 | Playwright route crawl covers billing return routes. | Billing return edge routes are covered locally. |

## Uncertainty

No production-like mutation was attempted. Without a dedicated staging account and integration credentials, real Withings/Strava/OAuth provider flows cannot be certified from this run.

