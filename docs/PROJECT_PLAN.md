# Kinetix — Project Plan

**Source of truth:** This file is reconstructed from the Kinetix repo, `docs/deployment/*`, feature lists, and recent `git` history. Umbrella-only standards are referenced by path where they live outside this clone.

**Last reviewed:** 2026-04-04 (repo scan).

---

## Vision

Kinetix is a **running-first personal performance** product: normalize effort via **KPS** (Kinetix Performance Score / NPI lineage), surface history and analytics in **web** and **native** clients, and add **LLM-assisted** coaching and retrieval (RAG) without turning the product into a social feed. It sits in the **Bookiji Inc** ecosystem: shared **Supabase** identity (`platform.profiles`), **entitlements** (`platform.entitlements`, `product_key = 'kinetix'`), and optional cross-app runtime packages (`@bookiji-inc/*`).

---

## Scope

**In scope (as implemented or actively maintained in this repo):**

- **Web (`apps/web`):** Vite + React SPA; GPS run recording; history, filters, charts; KPS per [`KPS_CONTRACT.md`](../KPS_CONTRACT.md) and [`packages/core`](../packages/core); Garmin ZIP / `.fit` import; Strava OAuth + import; Withings OAuth + weight history; AI coach paths (local Ollama and/or gateway); Help Center / support flows as wired to RAG and APIs.
- **RAG (`apps/rag`):** HTTP service — run indexing (`kinetix_runs`), help KB collection (`kinetix_support_kb`), LLM provider (`ollama` / `gateway`), Chroma embeddings. Support ticket endpoints writing **`kinetix.support_tickets`** (service role) per [`apps/rag/README.md`](../apps/rag/README.md).
- **Serverless API (`api/`):** Vercel functions — billing checkout, Strava/Withings OAuth helpers, `ai-chat` / `ai-coach`, admlog (non-prod), shared `_lib` (Stripe, Supabase JWT user, AI/memory boundary). See `vercel.json` rewrites.
- **Shared core (`packages/core`):** KPS math, location/physio helpers consumed by web (and intended for parity with native).
- **Native:** `ios/KinetixPhone`, `watchos/KinetixWatch` — sensor-rich coaching and sync (see [`FEATURES_PHONE.md`](../FEATURES_PHONE.md), [`FEATURES_WATCH.md`](../FEATURES_WATCH.md)).

**Explicitly documented as web limitations:** No HealthKit, no Watch live stream to browser, simulated heart rate on web, no map visualization of routes yet — see [`FEATURES_WEB.md`](../FEATURES_WEB.md) § Missing / Limitations.

---

## Non Goals

- **Not a Strava-style social graph** in product positioning (anti-feed / anti-performative running remains the design intent per [`README.md`](../README.md)).
- **No second Stripe webhook** on Kinetix: canonical **`POST /api/payments/webhook`** lives on **Bookiji**; Kinetix only creates Checkout sessions — see [`docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).
- **RAG service** does not implement end-user auth; the web app enforces access (`apps/rag/README.md`).
- **Schema migrations for the shared Supabase project** are not asserted as owned inside this repo snapshot; platform and product tables are consumed per deployment docs (TODO: confirm single migration repo of record in umbrella if needed).

---

## Architecture

| Layer | Technology | Evidence |
| ----- | ---------- | -------- |
| Web client | **Vite**, React, TypeScript | `apps/web`, `vercel.json` `"framework": "vite"` |
| Hosting | **Vercel** | `vercel.json`, `outputDirectory`: `apps/web/dist` |
| Serverless API | **Vercel** Node handlers | `api/**/*.ts`, `vercel.json` `functions` |
| Edge | TODO: document if any routes explicitly use Edge runtime | — |
| Auth / data plane | **Supabase** (same project as Bookiji for SSO) | [`docs/deployment/ENV_PARITY.md`](deployment/ENV_PARITY.md) |
| RAG + vectors | **Express** app, **Chroma**, embeddings | `apps/rag` |
| AI packages | `@bookiji-inc/ai-runtime`, persistent memory runtime | `apps/web/package.json`, `api/_lib/ai/*` |
| Native | SwiftUI, Watch Connectivity, HealthKit, Core ML | [`ARCHITECTURE.md`](../ARCHITECTURE.md) |

**Correction vs external briefs:** The production web app is **not** Next.js; do not describe Kinetix web as Next.js in internal docs.

---

## Data Model

**Client-side (web):** Run history, settings, and optional song metadata (`songTitle`, `songArtist`, `songBpm`) — persisted locally (storage strategy summarized in [`FEATURES_WEB.md`](../FEATURES_WEB.md); IndexedDB/Dexie referenced there for scale).

**Supabase (shared spine, read/write as implemented):**

- **`platform.profiles`** — profile rows keyed to auth user id (`apps/web/src/lib/platformAuth.ts`, `api/_lib/platformAuth.ts`).
- **`platform.entitlements`** — `product_key = 'kinetix'` for subscription gating (`platformAuth.ts`, [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md)).
- **`kinetix.support_tickets`** — RAG support ticket creation (`apps/rag/README.md`).

**KPS:** Computed from run facts + profile; display uses **relative KPS** vs PB per [`KPS_CONTRACT.md`](../KPS_CONTRACT.md) — not authoritative stored display state.

**TODO:** Trace and document every `kinetix.*` table the web client or API writes to (e.g. activity mirror mentioned in feature copy) with exact client paths, if product scope requires a single ER diagram here.

---

## Feature Roadmap

Roadmap phases below map **themes** to **evidence in repo/docs**. They are not dated releases.

### Phase 1 — Core Analytics

**Largely shipped (web + core):** Run logging, pace/distance/time, KPS/NPI, history UI, filters, charts (`FEATURES_WEB.md`). Native apps: full biomechanics and presets (`FEATURES_WATCH.md`, `FEATURES_PHONE.md`).

**Gaps (web):** Map visualization, export/share, real HR (see `FEATURES_WEB.md` limitations).

### Phase 2 — Intelligence Layer

**Shipped / partial:** RAG service (`apps/rag`), AI coach + chat API routes (`api/ai-coach`, `api/ai-chat`), Ollama + gateway resolution (`apps/rag/README.md`, recent commits on provider resolution). **Persistent memory boundary:** `api/_lib/ai/kinetixMemoryBoundary.ts`, `@bookiji-inc/persistent-memory-runtime`, `umbrellaRuntimeBridge.ts` (session payload shaping / optional umbrella bridge).

**In progress / tighten:** Entitlement-aware UX, error surfaces, observability consistency (`PRODUCT_SCOPE.md` marks several platform standards **Partial**).

### Phase 3 — Integrations

**Web — implemented per `FEATURES_WEB.md`:** Strava import, Garmin import, Withings weights.

**Native / health:** Deep HealthKit and Watch streaming are **native**, not live-mirrored to web (see architecture Q&A in prior reviews; no WebSocket Watch→web in `apps/web`).

**TODO:** Apple Health export/import parity matrix if product requires explicit milestones (see [`FEATURES_COMPARISON.md`](../FEATURES_COMPARISON.md)).

### Phase 4 — Monetization

**Implemented (code + docs):** `POST /api/billing/create-checkout-session`, Stripe subscription metadata, Bookiji webhook updates `platform.entitlements` — [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).

**Also in repo:** Google **AdSense** integration in web app (commit `87d2055` on current `main` history).

**Operational:** Production env parity, checklist, Infisical paths — [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md), [`INFISICAL_LOCAL_DEV.md`](deployment/INFISICAL_LOCAL_DEV.md).

---

## Current Status

- **Production web:** `apps/web` → `kinetix.bookiji.com` per [`REPO_STATUS.md`](../REPO_STATUS.md) and `vercel.json`.
- **Billing:** Documented as wired; live enablement depends on env (`BILLING_ENABLED`, Stripe price id, Bookiji webhook).
- **CI / quality:** Root scripts `lint`, `type-check`, `test`; **`pnpm run verify:vercel-parity`** matches standalone clone + Vercel install path (see [`README.md`](../README.md)).
- **Recent commits (sample):** AdSense; repo structure / deployment clarity; web dashboard reset/idle; LLM provider resolution for Vercel; Withings redirect URI; theme selector; RAG support ticket endpoints; entitlement query fixes; Vercel ESM/API packaging fixes.

---

## Completed

- Canonical web migration to **`apps/web`** (legacy in `archive/web-legacy/`) — [`REPO_STATUS.md`](../REPO_STATUS.md), [`docs/WEB_APPS.md`](WEB_APPS.md).
- KPS contract and shared calculator in **`packages/core`** — [`KPS_CONTRACT.md`](../KPS_CONTRACT.md).
- Strava / Garmin / Withings flows on web — [`FEATURES_WEB.md`](../FEATURES_WEB.md).
- RAG collections split (runs vs support KB) — `apps/rag/README.md`.
- Stripe checkout + Bookiji single-webhook entitlements design — [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).
- Optional song BPM fields (web feature list + validation rules described in `FEATURES_WEB.md`).

---

## In Progress

- **Subscription gating and billing UX** end-to-end in production tiers (code exists; operator checklist in deployment docs).
- **AI analysis reliability** — gateway envs, E2E allowances when AI gateway missing (see recent test/commit messages).
- **Platform standard adoption** — `PRODUCT_SCOPE.md`: CI baseline, env contract, observability, feature flags, error contract marked **Partial**.
- **Doc hygiene:** Keep `PRODUCT_SCOPE.md` platform table aligned with deployment docs when billing or spine changes land.

---

## Next Priorities

1. Close **Partial** rows in `PRODUCT_SCOPE.md` with measurable criteria (tests, dashboards, error contract coverage).
2. Web **map** and **export** (GPX/TCX) when prioritizing parity with user expectations (`FEATURES_WEB.md` future list).
3. **`pnpm run verify:vercel-parity`** on any change to `scripts/vercel-install.sh`, workspace packages, or `@bookiji-inc/*` consumption.

---

## Technical Debt

- **Scope doc vs code:** `PRODUCT_SCOPE.md` Stripe row was reconciled with checkout + Bookiji webhook docs (2026-04-04); re-check after major billing changes.
- **Web feature list freshness:** `FEATURES_WEB.md` last updated **2026-03-05** — re-audit against `apps/web` after large UI/auth changes.
- **Simulated HR on web** — blocks serious physio parity until Web Bluetooth or manual inputs expand.
- **No in-repo Supabase migration inventory** for `platform.*` / `kinetix.*` — risk of unclear ownership when schema changes (TODO: pointer to umbrella migration repo).

---

## Risks

- **Coupling to Bookiji:** Webhook downtime or schema drift on Bookiji side affects **entitlement** truth for Kinetix users.
- **Shared Supabase:** Auth redirect URL and RLS assumptions must stay aligned ([`ENV_PARITY.md`](deployment/ENV_PARITY.md)).
- **Standalone clone builds:** Production-like install uses `scripts/vercel-install.sh` + Bookiji-inc package clone; umbrella-only `../../packages` dev may hide breakage ([`README.md`](../README.md) parity section).
- **RAG + Chroma:** Operational complexity (local Docker/Python fallbacks); embedding and chunking quality directly affect coach usefulness.

---

## Dependencies

| Dependency | Role |
| ---------- | ---- |
| Bookiji app / Supabase project | SSO, `platform.profiles`, webhook handler for Stripe |
| `@bookiji-inc/*` packages | AI runtime, Stripe helpers, platform-auth, observability, error contract, persistent memory |
| Stripe | Subscription checkout (Kinetix API) + events → Bookiji webhook |
| Vercel | Host SPA + `api/*` serverless |
| Infisical (ops) | Secret merge `/platform` + `/kinetix` ([`INFISICAL_LOCAL_DEV.md`](deployment/INFISICAL_LOCAL_DEV.md)) |
| Optional: Ollama / AI gateway | LLM inference for coach and RAG |

---

## Bookiji Inc Integration

- **Identity:** Same Supabase project; magic link primary; optional OAuth via `VITE_AUTH_*_ENABLED` — [`ENV_PARITY.md`](deployment/ENV_PARITY.md).
- **Entitlements:** `platform.entitlements` with `product_key = 'kinetix'` — [`docs/deployment/README.md`](deployment/README.md).
- **Payments:** Single webhook rule on Bookiji — [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md) (idempotent event handling documented there and in Bookiji handler references).
- **Standards:** [`APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md) and [`SPINE_CONTRACT.md`](../../../../SPINE_CONTRACT.md) at umbrella root when this repo is checked out under `Bookiji inc/products/Kinetix`.
- **Optional memory bridge (governance, default off):** [`MEMORY_BRIDGE_CONTRACT.md`](../../../../docs/platform/MEMORY_BRIDGE_CONTRACT.md) — see deployment index; runtime touchpoints include `api/_lib/ai/umbrellaRuntimeBridge.ts` and persistent-memory runtime usage.

**Engineering rules (from org practice, enforced in docs/code):** No ad-hoc production DB edits; **migrations only** for schema; deterministic KPS logic per contract; webhook idempotency on Bookiji side for Stripe events.

---

## AI Strategy

- **Web:** Rule-based fallback when LLM unavailable; Ollama local dev; Vercel-oriented **gateway** path for hosted inference (see `apps/rag` env vars and recent `feat(llm)` commits).
- **RAG:** Separate collections for **runs** vs **support KB**; no automatic ticket ingestion into curated KB (`apps/rag/README.md`).
- **Memory:** Session boundary payload via `buildKinetixBoundaryFromChat` (`api/_lib/ai/kinetixMemoryBoundary.ts`) and `@bookiji-inc/persistent-memory-runtime`.
- **Native (iPhone):** Gemini for coaching — [`ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## Billing Strategy

- **Model:** Subscription Checkout created by Kinetix API; **Bookiji** webhook writes **`platform.entitlements`**; web reads entitlements via Supabase client — no Stripe secrets in browser bundle — [`STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md).
- **TODO:** Document exact UI surfaces that gate premium features (file-level pointers in `apps/web`).

---

## Deployment Strategy

- **Build:** `pnpm --filter @kinetix/core build` then `pnpm --filter @kinetix/web build`; Vercel `installCommand` runs `scripts/vercel-install.sh` — `vercel.json`.
- **Domain / DNS:** [`KINETIX_SUBDOMAIN.md`](deployment/KINETIX_SUBDOMAIN.md).
- **Verification:** [`KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md), `pnpm verify:infisical`, `pnpm run verify:vercel-parity`.

---

## Long Term Vision

- Deeper **biomechanics** on web where sensors allow, or keep web as **analytics + import hub** while Watch/iPhone own raw form streams ([`FEATURES_COMPARISON.md`](../FEATURES_COMPARISON.md)).
- **Training plans** and optional social/export features — see [`README.md`](../README.md) Future Enhancements and native feature docs.
- Tighter **platform** scores (observability, error contract, feature flags) to **Full** in `PRODUCT_SCOPE.md`.

---

## Related index

| Doc | Purpose |
| --- | ------- |
| [`../README.md`](../README.md) | Product overview, commands, spine compliance |
| [`../REPO_STATUS.md`](../REPO_STATUS.md) | Canonical directories |
| [`../PRODUCT_SCOPE.md`](../PRODUCT_SCOPE.md) | Audit scope (Stripe row aligned with deployment docs) |
| [`deployment/README.md`](deployment/README.md) | SSO, Infisical, Stripe, checklists |
| [`WEB_APPS.md`](WEB_APPS.md) | Canonical web vs legacy archive |
