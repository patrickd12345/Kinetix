# Kinetix Remediation Plan

Audit date: 2026-04-11

## P0 - Critical

No P0 issues were verified in this deterministic local audit.

## P1 - High

| ID | Title | Description | Risk | File location | Fix recommendation | Effort |
|---|---|---|---|---|---|---|
| DATA-01 | History hard delete bypasses PB/logical delete | History deletes `runs` rows directly instead of using `hideRun`. | Stale PB references, inconsistent history/chart stats, irreversible user data loss. | `apps/web/src/pages/History.tsx`; `apps/web/src/lib/database.ts` | Replace direct `db.runs.delete` with `hideRun`; add regression test for deleting current PB. | S |
| DATA-02 | Run save side effects are non-atomic | Run save, PB update, and RAG indexing happen in separate async steps. | Partial failure can leave saved run without PB reconciliation or RAG index. | `apps/web/src/store/runStore.ts` | Wrap local run/PB update in Dexie transaction; emit/index only after commit; surface save/index errors separately. | M |
| PERF-01 | Initial bundle exceeds budget | Main app chunk is 845.75 kB after minification. | Slow mobile startup and higher regression risk. | `apps/web/src/App.tsx`; build output | Move heavy pages/charts/markdown/operator code out of main chunk; add bundle budget check. | M |
| PERF-02 | Lazy route split defeated | `Coaching.tsx` is lazy in `App.tsx` but statically imported by `History.tsx`. | Coaching code remains in initial/shared path. | `apps/web/src/App.tsx`; `apps/web/src/pages/History.tsx` | Remove static route component import; extract shared types/helpers if needed. | S |
| SEC-01 | Markdown link protocol not constrained | Support queue renders markdown links from KB/operator content. | Potential unsafe scheme/link handling if malicious content enters KB draft. | `apps/web/src/pages/SupportQueue.tsx` | Add explicit URL transform/protocol allowlist for `http`, `https`, `mailto`; reject other schemes. | S |
| SEC-02 | Integration refresh tokens in localStorage | Settings store persists Withings/Strava credentials client-side. | XSS or local compromise can expose long-lived tokens. | `apps/web/src/store/settingsStore.ts` | Move refresh tokens server-side or encrypt/session-bound; document residual risk if kept client-side. | L |
| TEST-01 | Settings coverage is near zero | Coverage shows `Settings.tsx` 0.13%. | Integration/import regressions likely escape. | `apps/web/src/pages/Settings.tsx` | Add component tests for OAuth states, imports, manual sync, errors, and disabled states. | M |
| TEST-02 | Dashboard/run workflow coverage is near zero | `RunDashboard.tsx` 0.33%, panels 2.46%. | Core run UI regressions likely escape. | `apps/web/src/pages/RunDashboard.tsx`; `apps/web/src/pages/run-dashboard/*` | Add component/store tests for start/pause/resume/stop, modals, empty data, and errors. | M |
| TEST-03 | runStore behavior weakly tested | `runStore.ts` 17.68%, 0 funcs. | Live run math/save regressions likely escape. | `apps/web/src/store/runStore.ts` | Add deterministic store tests with mocked Dexie, KPS, PB, and RAG indexing. | M |
| AI-01 | AI coach JSON fallback is weak | `useAICoach` accepts malformed model text as truncated insight. | User can see unstructured or unsafe analysis. | `apps/web/src/hooks/useAICoach.ts` | Use schema validation and deterministic fallback title/insight; consider shared guardrails. | S |
| A11Y-01 | History icon buttons lack accessible names | Analyze/delete icons have no `aria-label`. | Screen reader users cannot identify actions. | `apps/web/src/pages/History.tsx` | Add `type="button"` and descriptive `aria-label`s. | XS |
| EDGE-01 | Heavy user scenario not generated | E2E did not seed large IndexedDB dataset. | Heavy-account regressions remain uncertain. | `apps/web/e2e/*` | Add deterministic heavy-user seed route/test fixture. | M |

## P2 - Medium

| ID | Title | Description | Risk | File location | Fix recommendation | Effort |
|---|---|---|---|---|---|---|
| PERF-03 | Lighthouse CI targets placeholder URL | `lh:ci` fails on `example.invalid`. | Performance/security browser audits are inactive. | `lighthouserc.json` | Point to local preview or deployment URL; add server startup in CI. | S |
| PERF-04 | Strava 429 path sleeps for 60 seconds | Client waits before retrying. | Frozen UX and long test runs. | `apps/web/src/lib/strava.ts` | Return rate-limit state immediately; schedule retry outside UI path. | S |
| DATA-03 | Strava dedupe uses date-distance key | Dedupe does not primarily use external activity ID. | Duplicate or missed imports. | `apps/web/src/lib/strava.ts` | Use `external_id` as primary idempotency key; keep date-distance as legacy fallback. | S |
| DATA-04 | Weight import count can over-report | `bulkPutWeightEntries` returns input length on overwrite. | Misleading sync/import feedback. | `apps/web/src/lib/database.ts` | Return inserted/updated counts or label as processed count. | S |
| DATA-05 | Raw Withings duplicate events can throw | `bulkAdd` is used for raw events. | Sync abort on duplicate raw events. | `apps/web/src/lib/database.ts` | Use `bulkPut` or catch duplicate-key errors per batch. | S |
| DATA-06 | Weight lookup scans history | `getWeightAtDate` scans all entries before date. | Heavy histories can slow KPS calculation. | `apps/web/src/lib/database.ts` | Use indexed reverse query or cached date map. | S |
| A11Y-02 | Chat focus treatment is weak | Input removes outline and only changes border. | Keyboard focus may be hard to see. | `apps/web/src/pages/Chat.tsx` | Use `shell-focus-ring` or equivalent visible ring. | XS |
| A11Y-03 | Goal progress form controls lack labels | Selects/inputs are visually grouped but not explicitly labelled. | Screen reader form ambiguity. | `apps/web/src/components/KinetixGoalProgressCard.tsx` | Add visible labels or `aria-label`/`htmlFor`. | S |
| AI-02 | `/api/ai-coach` has weaker guardrails | Generic prompt, temperature 0.7, no response contract. | Hallucinated or unsupported coaching analysis. | `api/_lib/ai/requestHandlers.ts`; `apps/web/src/hooks/useAICoach.ts` | Reuse coach guardrail contract and lower temperature for factual run analysis. | M |
| AI-03 | AI timeouts are long | 60-90 second timeouts on interactive AI paths. | Users perceive hangs. | `api/_lib/ai/llmClient.ts`; `apps/web/src/lib/helpCenterSupportAi.ts` | Add shorter UI timeout and progressive status/fallback. | S |
| SEC-03 | E2E bypass must stay impossible in prod | Support bypass depends on `MASTER_ACCESS`. | Misconfigured production would be severe. | `apps/web/src/lib/debug/masterAccess.ts`; `api/_lib/supportOperator.ts` | Add deployment/env parity assertion covering support bypass. | S |
| TEST-04 | WeightHistory coverage low | 2.32% statement coverage. | Weight UI regressions likely escape. | `apps/web/src/pages/WeightHistory.tsx` | Add pagination, empty, loaded, and sync-event tests. | S |
| TEST-05 | Overall coverage low for UI | Overall statements 42.56%. | Route-level regressions are underdetected. | `apps/web/src` | Add per-area thresholds after filling key gaps. | M |
| SEC-06 | API negative tests are uneven | Not every handler has method/CORS/auth tests. | Auth/CORS regressions can slip through. | `api/*` | Add shared API handler test harness. | M |
| EDGE-02 | Live smoke blocked | No staging URL/test account provided. | Real auth/OAuth/entitlement/provider behavior uncertain. | Deployment/config | Provide dedicated staging account and rerun constrained live smoke. | M |

## P3 - Nice To Have

| ID | Title | Description | Risk | File location | Fix recommendation | Effort |
|---|---|---|---|---|---|---|
| TEST-07 | Passing tests are noisy | Expected thrown errors and Dexie missing-API stacks appear in output. | CI logs obscure real failures. | `apps/web/src/context/*test*`; `apps/web/src/lib/strava.test.ts` | Spy/suppress expected console errors or assert with error boundary harness. | S |
| PERF-07 | AdSense polling timer | Display unit polls for script global. | Minor overhead. | `apps/web/src/components/ads/AdSenseDisplayUnit.tsx` | Bound attempts or use script-load event if available. | XS |
| UI-06 | Weight route deeper UX coverage | Route loads, but states are underasserted. | Polish regressions. | `apps/web/src/pages/WeightHistory.tsx` | Add visual/interaction assertions. | S |

## Verification Snapshot

- Type-check and build passed.
- Web/API coverage run passed: 82 files, 356 tests, 42.56% statements.
- RAG tests passed: 41 node tests.
- Shared package tests passed.
- Playwright E2E passed: 43 tests, all requested routes audited locally.
- Lighthouse CI blocked by placeholder URL.
- Live/staging smoke blocked by missing staging URL/test account.

