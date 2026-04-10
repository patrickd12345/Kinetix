# Kinetix system map (repository evidence)

Generated from a full crawl of this workspace (`/workspace`). The product’s canonical **web** surface is `apps/web` (Vite + React). Native apps live under `ios/` and `watchos/`. Shared scoring logic is in `packages/core` (`@kinetix/core`). Serverless HTTP handlers for production live under `api/` (Vercel functions).

## Web app (`apps/web`)

| Area | Location | Notes |
|------|-----------|--------|
| Entry | `src/main.tsx` | React mount |
| Routing | `src/App.tsx` | `BrowserRouter`, public routes (`/login`, `/billing/*`), protected shell under `/*` |
| Layout / nav | `src/components/Layout.tsx` | Sidebar (md+), mobile bottom nav + “More” dialog |
| Auth | `src/components/providers/AuthProvider.tsx`, `src/lib/platformAuth.ts`, `src/lib/supabaseClient.ts` | Supabase session + `platform.profiles` + `platform.entitlements` |
| Global state | `src/store/*.ts` (Zustand), Dexie/IndexedDB via `src/lib/database.ts` patterns |
| Feature flags | `src/lib/featureFlags.ts` | `VITE_ENABLE_*` env toggles |
| Audit master access | `src/lib/debug/masterAccess.ts` | `VITE_MASTER_ACCESS` — **off by default**; enables entitlement bypass + all flags for crawls |

### Declared routes (`src/App.tsx`)

**Public**

- `/login`
- `/billing/success`, `/billing/cancel`

**Protected (inside `Layout`)**

- `/` — Run dashboard
- `/history`
- `/coaching`
- `/weight-history`
- `/menu` (charts)
- `/chat`
- `/settings`
- `/help` (Help Center)
- `/operator` (operator dashboard)
- `/support-queue`
- `*` → redirect `/`

### Client → server calls (relative URLs)

| Client | Path | Purpose |
|--------|------|---------|
| `useChat.ts`, `Chat.tsx` | `POST /api/ai-chat` | Coach chat |
| `useAICoach.ts` | `POST /api/ai-coach` | Coaching API |
| `kinetixBilling.ts` | `POST /api/billing/create-checkout-session` | Stripe Checkout |
| `strava.ts`, `useStravaAuth.ts` | `/api/strava-refresh`, `/api/strava-oauth` | Strava token + OAuth |
| `withings.ts`, integrations | `/api/withings-refresh`, `/api/withings-oauth` | Withings |
| `supportQueueClient.ts` | `/api/support-queue/*` | Operator queue (Bearer JWT) |

**Local Vite:** `vite.config.shared.ts` proxies `/api/strava` to Strava’s API only; other `/api/*` routes are **not** implemented by the default Vite server (Playwright tests accept `404` for AI routes when not deployed).

### Vercel / production (`vercel.json`)

- SPA fallback: `/(?!api/).*` → `index.html`
- Functions: `api/**/*.ts`
- Rewrites for Withings and Strava paths as documented in `vercel.json`

## API layer (`api/`)

| Handler | File | Role |
|---------|------|------|
| AI chat | `api/ai-chat/index.ts` | LLM gateway / fallback |
| AI coach | `api/ai-coach/index.ts` | Structured coach responses |
| Billing | `api/billing/create-checkout-session/index.ts` | Stripe Checkout session |
| Strava OAuth | `api/strava-oauth/index.ts` | OAuth callback |
| Strava refresh | `api/strava-refresh/index.ts` | Token refresh |
| Strava proxy | `api/strava-proxy/index.ts` | Proxied Strava REST |
| Withings | `api/withings/index.ts` | OAuth + refresh (rewritten from `-oauth` / `-refresh`) |
| Support queue | `api/support-queue/[[...segments]].ts` | Tickets, KB drafts, SLA — **`requireSupportOperator`** |
| Adm log | `api/admlog/index.ts` | Operational logging |
| Escalation notify | `api/escalationNotify.ts` | Escalation notifications |

Shared logic: `api/_lib/` (CORS, Supabase JWT, support queue store, AI guardrails, Stripe, etc.).

**Operator gate:** `api/_lib/supportOperator.ts` — allowlist via `KINETIX_SUPPORT_OPERATOR_USER_IDS`; optional **`KINETIX_MASTER_ACCESS`** for audit (bypass token matching Vite skip-auth session — see remediation doc).

## RAG service (`apps/rag`)

Optional HTTP service for embeddings/retrieval (see `apps/rag/README.md`). Web client sync references `ragClient` / env URLs.

## Packages

| Package | Path | Role |
|---------|------|------|
| `@kinetix/core` | `packages/core` | KPS, shared math, contracts |
| `@bookiji-inc/*` | `monorepo-packages/*` | AI runtime, errors, observability, platform-auth, stripe-runtime |

## Native

| Platform | Path | Stack |
|----------|------|--------|
| watchOS | `watchos/KinetixWatch` | SwiftUI, SwiftData, Watch Connectivity |
| iOS | `ios/KinetixPhone` | SwiftUI, SwiftData, Gemini, voice |

**Note:** This audit’s automated UI crawl targeted **web** only. Native apps were not executed in this environment (no Xcode run).

## `products/Kinetix`

Contains `README.md` pointing to scope-closure docs; not a separate app tree.
