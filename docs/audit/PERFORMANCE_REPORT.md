# Kinetix Performance Report

Audit date: 2026-04-11

## Build Evidence

`pnpm --filter @kinetix/web build` passed. Vite output included:
- `assets/index-*.js`: 845.75 kB, warning above 700 kB.
- `assets/recharts-vendor-*.js`: 361.81 kB.
- `assets/SupportQueue-*.js`: 183.03 kB.
- `assets/react-core-*.js`: 142.35 kB.
- Warning: `Coaching.tsx` is dynamically imported by `App.tsx` but statically imported by `History.tsx`, so it cannot move into its own chunk.

`pnpm lh:ci` is blocked because `lighthouserc.json` points at `https://example.invalid/lighthouse-placeholder`; Chrome navigates to `chrome-error://chromewebdata/`.

## Findings

| ID | Severity | Evidence | Finding | Estimated Gain |
|---|---|---|---|---|
| PERF-01 | P1 | Vite main chunk 845.75 kB. | Initial JS payload is too large for mobile/slow network. | 20-40% lower initial JS if heavy pages/charts move out of main chunk. |
| PERF-02 | P1 | Vite warning: `Coaching.tsx` lazy import defeated by static import in `History.tsx`. | Route-level lazy loading is not working as intended. | Lower initial parse/eval and cleaner route chunks. |
| PERF-03 | P2 | `lighthouserc.json` placeholder URL. | Performance CI is nonfunctional. | Restores repeatable Lighthouse budget enforcement. |
| PERF-04 | P2 | `apps/web/src/lib/strava.ts` waits 60 seconds on HTTP 429. | Client sync can hang background flows and tests. | Immediate UX recovery; prevents minute-long stalls. |
| PERF-05 | P2 | `History.tsx`, `Menu.tsx`, and coaching hooks use full `toArray()`/all-run reads for filters/charts/context. | Heavy users may hit IndexedDB and render bottlenecks. | Better heavy-history responsiveness with indexed pagination/caching. |
| PERF-06 | P2 | Coverage low for `RunDashboard`, `Settings`, `WeightHistory`. | Performance regressions on complex screens may escape tests. | Earlier detection, not direct runtime gain. |
| PERF-07 | P3 | AdSense display polls with interval until script global exists. | Minor timer overhead; acceptable but should remain bounded. | Small cleanup. |

## Hot Spots

- Initial bundle: dashboard, shared engines, chart dependencies, and non-lazy imports.
- Charts: Recharts vendor chunk is large; route-level deferral is important.
- IndexedDB: full history reads for filters and charts should be bounded or cached for heavy accounts.
- Startup effects: Layout runs RAG sync and Strava sync attempts after auth/profile; useful, but should stay capped and abortable.

## Blocked Measurements

Lighthouse score cannot be trusted until `lighthouserc.json` uses a real local preview URL or deployed URL.

