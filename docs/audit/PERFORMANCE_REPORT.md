# Performance report — web bundle

## Build output (evidence)

Command: `pnpm --filter @kinetix/web build` (production Vite build).

Approximate **minified JS** sizes from `apps/web/dist/assets/`:

| Chunk | Size (approx) |
|-------|----------------|
| `index-*.js` (main app) | ~879 KB |
| `recharts-vendor-*.js` | ~362 KB |
| `react-core-*.js` | ~142 KB |
| `lucide-*.js` | ~21 KB |
| `react-router-*.js` | ~21 KB |
| `supabase-*.js` | 0 KB (empty chunk — see finding) |

Vite warned: **main chunk > 700 KB** after minification.

## Findings

1. **Large main bundle:** The primary `index-*.js` chunk is close to **900 KB** minified. Risk: slow TTI on mobile networks.
2. **Recharts vendor split:** Large chart library isolated — good; still heavy.
3. **Empty `supabase` chunk:** Rollup emitted an empty chunk named `supabase` (`build` log). Likely a manualChunks split artifact — worth cleaning to avoid confusion and redundant requests.
4. **Lighthouse:** Not executed in this environment (no stable `lighthouse` CLI run against a public HTTPS origin). Recommend running Lighthouse on **staging/production** URLs.

## Recommendations

- **Code-split** heavy routes (Coaching, Menu/charts, Operator) via `React.lazy` + `Suspense`.
- **Review** `manualChunks` in `apps/web/vite.config.ts` for the empty supabase chunk.
- Run **Lighthouse** (performance + accessibility) on deployed preview.

## Runtime profiling

- React Profiler / memory snapshots were **not** captured in this audit session.
