# Phase 5 — Post-launch backlog (classified)

**Last updated:** 2026-04-10  
**Guardrail:** Wave 2 web **closed**; items below are **explicitly post-launch** — they do not reopen Wave 2 delivery scope.

Classification tags: **nice-to-have**, **performance**, **UX**, **reliability**.

| Item | Tags | Notes / evidence |
|------|------|------------------|
| Web **map visualization** for recorded GPS routes | nice-to-have, UX | [`FEATURES_WEB.md`](../FEATURES_WEB.md) § Missing / Limitations; [`PROJECT_PLAN.md`](PROJECT_PLAN.md) non-goals vs roadmap. |
| **Export / share** (GPX/TCX or share sheet) | nice-to-have, UX | Same; native may lead; web is analytics/import hub today. |
| **Billing UX** end-to-end polish (post-Stripe enablement) | UX, reliability | Entitlements via Bookiji webhook — surface states, errors, renewal messaging per [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md). |
| **AI reliability** in hosted gateway env (timeouts, fallbacks, user-visible degradation) | reliability, performance | AI routes + RAG; expand E2E when gateway stable — [`PHASE4_E2E_PLAN.md`](PHASE4_E2E_PLAN.md). |
| **Error contract uniformity** completion (remaining `api/*` handlers) | reliability | [`PHASE3_ERROR_CONTRACT_ROLLOUT.md`](PHASE3_ERROR_CONTRACT_ROLLOUT.md) P0/P1 table. |
| **Observability** — align `escalationNotify` with `logApiEvent`; optional metrics | performance, reliability | [`PHASE3_OBSERVABILITY_AUDIT.md`](PHASE3_OBSERVABILITY_AUDIT.md). |
| **CI** — optional RAG path filter + Playwright job | performance, reliability | [`PHASE3_CI_AUDIT.md`](PHASE3_CI_AUDIT.md). |
| Web **real HR** / sensor expansion (Web Bluetooth, manual inputs) | UX, nice-to-have | [`FEATURES_WEB.md`](../FEATURES_WEB.md) simulated HR limitation. |
| **Training plans** / deeper biomechanics on web | nice-to-have, UX | [`PROJECT_PLAN.md`](PROJECT_PLAN.md) long-term vision. |

## References

- [`KINETIX_SCOPE_CLOSURE.md`](KINETIX_SCOPE_CLOSURE.md) — Phase 5 pointer.
- [`PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) — platform scores toward **Full**.
