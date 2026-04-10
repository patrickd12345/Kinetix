# Edge case report

## Covered by automated tests (evidence)

| Scenario | Where |
|----------|--------|
| Missing / failed AI backend | `e2e/ai-chat-smoke.spec.ts` (502 + `ai_execution_failed`), `src/test/ai-route-errors.test.ts` |
| Entitlement denied | `src/integration/auth-entitlement.integration.test.tsx` |
| Operator dashboard flag off | `src/integration/operator-dashboard.integration.test.tsx` |
| Escalation flag off | `src/test/escalation-notify-route.test.ts`, `src/lib/helpcenter/escalation.test.ts` |
| Billing return routes | `src/integration/billing-return-routes.integration.test.tsx` |
| Shell a11y / themes | `e2e/shell-dashboard.spec.ts`, `e2e/help-center-a11y.spec.ts` |

## Not adequately covered

| Scenario | Risk | Suggestion |
|----------|------|------------|
| **Empty user** (no runs) | Blank states / division by zero | Visual + unit tests on dashboard with zero runs |
| **Heavy user** (thousands of runs) | List perf, memory | Virtualization tests on History |
| **Slow network** | Timeouts, UX | Playwright `route` throttling + skeleton assertions |
| **Offline** | Queue failed API calls | Service worker not in scope; document as N/A or add PWA tests |
| **API failure** (500 on profile) | Auth error UI | Integration test with mocked Supabase errors |

## Notes

- Playwright runs with **local** Vite; network conditions are **fast localhost** unless explicitly simulated.
