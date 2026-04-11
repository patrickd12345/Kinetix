# Kinetix UI / UX Audit Report

Audit date: 2026-04-11

## Route Coverage

Local Playwright audit crawl passed for `/`, `/history`, `/coaching`, `/weight-history`, `/menu`, `/chat`, `/settings`, `/help`, `/operator`, `/support-queue`, `/login`, `/billing/success`, and `/billing/cancel`. Additional E2E passed for charts desktop/mobile, Help search, AI chat, operator/queue smoke, settings interactions, shell desktop/tablet/mobile, and run dashboard modals.

## Findings

| ID | Severity | Screen | Evidence | Finding |
|---|---|---|---|---|
| UI-01 | P2 | All protected routes | `Layout.tsx` has consistent desktop sidebar and mobile bottom nav; Playwright shell tests passed. | Navigation consistency is strong locally; no route-load regressions found. |
| UI-02 | P2 | Dashboard | Coverage: `RunDashboard.tsx` 0.33%; panels 2.46%. | Dashboard UI behavior is smoke-tested but lacks deterministic tests for loading/error/empty run states. |
| UI-03 | P2 | Settings | Coverage: `Settings.tsx` 0.13%; screen contains integrations, imports, OAuth, file inputs, and sync controls. | Settings is too large and under-tested for its risk level. |
| UI-04 | P2 | History | `History.tsx` hard deletes via `db.runs.delete`; delete control uses icon-only button without `aria-label`. | Delete UX is irreversible and not aligned with logical-delete data model; icon action lacks accessible name. |
| UI-05 | P2 | Chat | `Chat.tsx` input uses `focus:outline-none` with only border-color replacement. | Focus treatment is less visible than shell focus ring and should be standardized. |
| UI-06 | P3 | Weight | `WeightHistory.tsx` coverage 2.32%; route loads in Playwright. | Basic load passes, but pagination/empty/error states need targeted assertions. |
| UI-07 | P3 | Charts | `charts.spec.ts` passes desktop and mobile; chart components expose keyboard instructions. | Chart load and mobile behavior pass; deeper chart data density/heavy-history visual checks remain static-only. |
| UI-08 | P3 | Operator/Queue | Operator and support queue smoke tests pass. | Ops screens have route and workflow coverage; markdown security hardening still needed. |
| UI-09 | P3 | Billing returns | Billing return routes load/axe through audit crawl and integration tests. | No local UI regressions observed. |

## Screen Summary

| Screen | Status |
|---|---|
| Dashboard | Loads and shell passes; run workflow state coverage weak. |
| History | Loads; filters/pagination covered; delete semantics need remediation. |
| Coaching | Loads and unit tests exist; lazy split defeated by static import elsewhere. |
| Chat | Loads and smoke send passes; focus style and AI fallback details need hardening. |
| Help | Strongest coverage: support search, keyboard controls, axe checks, escalation integration. |
| Settings | Loads and simple interactions pass; coverage and complexity are risk. |
| Weight | Loads; low component coverage. |
| Charts | Desktop/mobile load tests pass. |
| Operator | Smoke and integration coverage pass. |
| Queue | Smoke/integration coverage pass; markdown/link handling should be hardened. |

