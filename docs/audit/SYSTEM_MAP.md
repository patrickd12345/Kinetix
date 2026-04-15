# Kinetix System Map

Audit date: 2026-04-11  
Scope: `apps/web/src`, `apps/rag`, `api`, `packages/core/src`, active `monorepo-packages/*/src`.

## Architecture Diagram

```text
Browser
  -> apps/web Vite React SPA
     -> main.tsx: AppErrorBoundary, AuthProvider, theme hydration
     -> App.tsx: BrowserRouter, public routes, ProtectedRoutes
     -> Layout.tsx: shell nav, startup RAG sync, startup Strava sync,
        Withings prompt, AdSense
     -> pages/components/hooks
  -> client state/storage
     -> Zustand: settingsStore, runStore, themeStore
     -> Dexie KinetixDB: runs, pb, weightHistory, provider sync, healthMetrics
     -> localStorage/sessionStorage: settings, theme, coach memory, OAuth state,
        RAG failure banner state
  -> API/RAG
     -> api/* Vercel handlers
     -> apps/rag Express service, Chroma, embeddings, support KB
  -> external systems
     -> Supabase, Stripe, Withings, Strava, Slack, Resend, AI gateway/Ollama
```

## Entry Points And Routes

Verified entry points:
- `apps/web/src/main.tsx`: React root, error boundary, auth provider, theme hydration.
- `apps/web/src/App.tsx`: router, protected route gate, lazy route boundaries.
- `apps/rag/index.js`: RAG service process entry.
- `apps/rag/ragHttpApp.js`: Express app factory.
- `api/*/index.ts` and `api/escalationNotify.ts`: Vercel function handlers.

Routes from `apps/web/src/App.tsx`:

| Route | Component | Protection | Notes |
|---|---|---|---|
| `/` | `RunDashboard` | Protected | Dashboard/run session. |
| `/history` | `History` | Protected | Run history, filters, delete, AI analysis. |
| `/coaching` | lazy `Coaching` | Protected | Coaching cards and planning. |
| `/weight-history` | `WeightHistory` | Protected | Weight pagination/chart source. |
| `/menu` | lazy `Menu` | Protected | Charts tab view. |
| `/chat` | `Chat` | Protected | AI coach chat. |
| `/settings` | `Settings` | Protected | Integrations/import/settings. |
| `/help` | `HelpCenter` | Protected | Support search/escalation. |
| `/operator` | lazy `OperatorDashboard` | Protected | Ops summary. |
| `/support-queue` | lazy `SupportQueue` | Protected | Ops ticket/KB workflow. |
| `/login` | `Login` | Public | Magic link/OAuth. |
| `/billing/success` | `BillingSuccess` | Public | Billing return route. |
| `/billing/cancel` | `BillingCancel` | Public | Billing return route. |

Local Playwright audit crawl tested all routes above.

## Module Breakdown

| Area | Modules | Classification |
|---|---|---|
| App shell/auth | `App.tsx`, `main.tsx`, `components/Layout.tsx`, `components/providers/*`, `AppErrorBoundary.tsx` | Routing, auth/entitlement gate, layout shell, startup effects. |
| Pages | `pages/*.tsx`, `pages/run-dashboard/*` | User-facing UI screens and route-specific workflows. |
| Components | `components/Kinetix*`, charts, `RunCalendar`, `RunDetails`, `ThemeSelector`, `a11y/Dialog` | Cards, chart UI, modal/focus primitives. |
| State | `store/settingsStore.ts`, `store/runStore.ts`, `store/themeStore.ts` | Persistent settings, live run state, theme state. |
| Client data | `lib/database.ts`, `lib/kpsUtils.ts`, `lib/authState.ts` | Dexie schema, PB/KPS invariants, profile/weight lookup. |
| Integrations | `lib/strava.ts`, `lib/withings.ts`, `lib/integrations/withings/*`, API Withings/Strava handlers | OAuth, sync, normalization, import. |
| AI/client | `hooks/useChat.ts`, `hooks/useAICoach.ts`, `lib/ragClient.ts`, `lib/supportRagClient.ts`, coaching hooks/engines | Chat, coach, RAG context, deterministic coaching engines. |
| API/server | `api/*`, `api/_lib/*` | CORS, auth, AI handlers, support queue, billing, notifications, env. |
| RAG service | `apps/rag/*` | Express endpoints, Chroma vector DB, embeddings, support KB/tickets. |
| Core package | `packages/core/src/*` | KPS, chat math, location, physio primitives. |
| Shared packages | `monorepo-packages/*/src` | AI runtime/core, observability, platform auth, persistent memory, Stripe runtime, error contract. |

No explored source module in the requested scope remained unclassified.

## Dependency Map

Main runtime dependencies:
- React 18, React Router 6, Vite, Tailwind, Recharts, React Markdown, Dexie, Zustand.
- Supabase JS/SSR for auth/data.
- OpenAI/Gateway/Ollama wrappers in shared AI packages and RAG service.
- Stripe runtime package and Stripe SDK.
- Express/Chroma/Ollama for local RAG.
- Playwright, Vitest, axe-core, Lighthouse CI for verification.

## Risk Areas

| ID | Severity | Evidence | Risk |
|---|---|---|---|
| SYS-01 | P1 | `apps/web/src/pages/History.tsx` uses `db.runs.delete(id)` while `lib/database.ts` defines logical delete via `hideRun`. | Hard delete can bypass PB cleanup and contradict documented deleted-run semantics. |
| SYS-02 | P2 | Build output warns `Coaching.tsx` is dynamically imported by `App.tsx` and statically imported by `History.tsx`. | Lazy route split is defeated. |
| SYS-03 | P2 | Build output: `assets/index-*.js` 845.75 kB and `recharts-vendor` 361.81 kB. | Initial JS payload is high for mobile and slow networks. |
| SYS-04 | P2 | `lighthouserc.json` targets `https://example.invalid/lighthouse-placeholder`. | Lighthouse CI cannot validate real app performance/accessibility. |
| SYS-05 | P2 | `apps/web/src/lib/strava.ts` sleeps 60 seconds on HTTP 429. | UI/background sync can hang and delay user feedback. |
| SYS-06 | P2 | `settingsStore.ts` persists integration credentials in browser storage. | Token exposure impact is high if XSS occurs. |
| SYS-07 | P3 | Vitest logs expected thrown React errors and Dexie missing-API errors on passing tests. | Passing suites are noisy. |
