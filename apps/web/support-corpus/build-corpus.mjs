/**
 * Regenerates support-artifacts.json from the in-file artifact list.
 * Run: node apps/web/support-corpus/build-corpus.mjs
 */
import fs from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {Record<string, unknown>[]} */
const ARTIFACTS = [
  {
    artifact_id: 'web-help-center-route',
    title: 'Opening the Help Center (/help)',
    body_markdown: `## Where it lives

In the Kinetix **web** app, **Help Center** is at route **\`/help\`**. It is linked from the main navigation (header, sidebar, and mobile bottom nav) as **Help**.

## What it covers

Self-service support: links to **Coach chat**, **Search support articles** (curated KB retrieval), troubleshooting, FAQ, and **AI-controlled escalation** (confirm before ticket; optional mailto fallback if \`VITE_SUPPORT_EMAIL\` is set when the ticket API fails).

**Source:** \`apps/web/src/pages/HelpCenter.tsx\`, route in \`apps/web/src/App.tsx\`.`,
    version: 2,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-support-search-vs-coach-chat',
    title: 'Support article search vs Coach chat',
    body_markdown: `## Two different systems

**Coach chat** (\`/chat\`) uses **run RAG** (\`kinetix_runs\` in the RAG service). The coach receives **COACH CONTEXT** from your run history via \`getCoachContext\` and calls **\`/api/ai-chat\`**. It answers training and pacing questions grounded in your runs.

**Search support articles** on Help Center calls **\`POST /support/kb/query\`** on the same RAG **service URL** but a **separate** Chroma collection: **\`kinetix_support_kb\`**. The UI shows **retrieval excerpts only** — not a generated AI answer in that box.

## When to use which

- Run-specific coaching, KPS, pacing: **Coach chat**.
- Product how-tos, OAuth, imports, policies as written in the curated KB: **Support search**.

**Source:** \`apps/web/src/hooks/useChat.ts\`, \`apps/web/src/lib/supportRagClient.ts\`, \`apps/rag/README.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-support-kb-retrieval-not-llm',
    title: 'Support KB search shows excerpts, not AI answers',
    body_markdown: `## Behavior

The Help Center **Search support articles** field sends your question to **\`querySupportKB\`** (\`apps/web/src/lib/supportRagClient.ts\`), which performs **semantic search** over **\`kinetix_support_kb\`** only.

The page displays **matching chunks** (title, topic metadata, excerpt text). It does **not** run an LLM to synthesize a bespoke answer in that UI.

## Why results may look short

Chunks are sized for embedding retrieval; you see a truncated excerpt in the UI.

**Source:** \`apps/web/src/pages/HelpCenter.tsx\`, \`apps/web/HELP_CENTER.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'limitation',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-deterministic-fallback',
    title: 'Deterministic fallback when support search is weak or unavailable',
    body_markdown: `## When it appears

The **Deterministic fallback** panel is shown when:

- The RAG service is **unreachable** (\`querySupportKB\` returns unavailable), or
- The HTTP request **fails**, or the response is **invalid**, or
- Retrieval returns **no results**, or
- The **best match similarity** is below **\`MIN_USEFUL_SIMILARITY\` (0.15)** in \`apps/web/src/lib/helpCenterFallback.ts\`.

## What it is

**Fixed, rule-based tips** keyed by a coarse inferred topic (sync, import, KPS, general). It is **explicitly not** an AI-generated answer (\`DETERMINISTIC_FALLBACK_DISCLAIMER\` in the UI).

## What to do

Follow the bullets, use **Settings**, **Coach chat**, or confirm **escalation to the team** when the Help Center proposes it (after \`POST /support/ticket/create\` on the RAG service, or mailto fallback if configured).

**Source:** \`apps/web/src/lib/helpCenterFallback.ts\`, \`apps/web/src/pages/HelpCenter.tsx\`.`,
    version: 2,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-weak-similarity-message',
    title: 'Why you see "matches look weak" in support search',
    body_markdown: `## Meaning

If the KB returns chunks but the **highest similarity score is below 0.15**, the app treats the match as **not useful enough** and still shows **Deterministic fallback** plus an amber note that matches **look weak**.

You may still see the low-scoring excerpts listed for transparency.

**Source:** \`isWeakOrEmptyRetrieval\` in \`apps/web/src/lib/helpCenterFallback.ts\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-escalation-mailto-payload',
    title: 'AI-controlled escalation and ticket payload',
    body_markdown: `## Behavior

There is **no** self-serve open ticket button. When triggers in \`shouldProposeEscalation\` fire (low confidence, service error, empty results, second weak attempt, or user marks still not resolved), Help Center asks to **escalate to the team**. On confirmation, the app calls **\`POST /support/ticket/create\`** on the RAG service with a structured JSON body (product, user id, summary, excerpts, attempted solutions, environment, severity).

If \`VITE_SUPPORT_EMAIL\` is set and the ticket API fails, a **mailto** opens with the same JSON via \`buildTicketPayloadMailtoHref\`. Legacy plain-text helpers in \`helpCenterEscalation.ts\` may still be used for diagnostic copy.

**Source:** \`apps/web/src/lib/supportRagClient.ts\`, \`apps/web/src/lib/helpCenterEscalation.ts\`, \`apps/web/src/pages/HelpCenter.tsx\`, \`apps/rag/services/supportTicketCreate.js\`.`,
    version: 2,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'policy',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-rag-service-url-resolution',
    title: 'How the web app finds the RAG service URL',
    body_markdown: `## Order

1. If **\`VITE_RAG_SERVICE_URL\`** is set in the Vite environment, that base URL is used (\`apps/web/src/lib/ragClient.ts\` — \`getRAGBaseUrl\`).
2. Otherwise the client probes **localhost ports 3001 through 3010** with **GET \`/health\`** (1.5s timeout per port) and caches the first match.

## Impact

If nothing responds, **support KB search** and **run indexing/coach context** that depend on the RAG service will not work from the browser.

**Source:** \`apps/web/src/lib/ragClient.ts\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'sync',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-support-kb-unavailable-message',
    title: 'Curated support search unavailable (RAG service)',
    body_markdown: `## What you see

Help Center shows a message that curated support search is **unavailable** when the app cannot reach the RAG service (no base URL, network error, timeout, or HTTP 503 from \`querySupportKB\`).

## What to try

- Run **\`apps/rag\`** locally (\`pnpm start\`, default **http://localhost:3001**) or set **\`VITE_RAG_SERVICE_URL\`** to your deployed RAG base URL.
- Use **Deterministic fallback** tips, **Coach chat** (may still need API/RAG depending on feature), and **Settings**.

**Source:** \`apps/web/src/lib/supportRagClient.ts\`, \`apps/web/src/pages/HelpCenter.tsx\`, \`apps/rag/README.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'sync',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'rag-support-kb-collections-separate',
    title: 'Support KB and run data never mix in RAG',
    body_markdown: `## Architecture

The Kinetix RAG service stores:

- **\`kinetix_runs\`** — run embeddings for similarity, analyze, coach context.
- **\`kinetix_support_kb\`** — curated support articles only.

Support chunks are **not** added to the run collection. This avoids polluting run similarity search.

**Endpoints:** \`POST /support/kb/ingest\`, \`POST /support/kb/query\`, \`GET /support/kb/stats\`.

**Source:** \`apps/rag/README.md\`, \`apps/web/HELP_CENTER_ARCHITECTURE.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'policy',
    source_type: 'editorial',
  },
  {
    artifact_id: 'rag-support-kb-ingest-rules',
    title: 'Ingesting articles into the support KB',
    body_markdown: `## API

**\`POST /support/kb/ingest\`** accepts a JSON body \`{ "artifact": { ... } }\`.

**\`validateSupportArtifactForIngest\`** (\`apps/rag/services/supportArtifact.js\`) requires among other fields: \`artifact_id\`, \`title\`, \`body_markdown\`, \`version\` ≥ 1, \`review_status: "approved"\`, \`topic\` (account, billing, sync, import, kps, charts, privacy, general), \`intent\` (howto, troubleshoot, policy, limitation), \`source_type\` (editorial, ticket_resolution, faq), \`product: "kinetix"\`.

Draft or deprecated artifacts are **rejected**.

## Query

**\`POST /support/kb/query\`** accepts \`query\`, optional \`topK\`, optional \`topic\` filter.

**Source:** \`apps/rag/services/supportArtifact.js\`, \`apps/rag/README.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-strava-oauth-settings',
    title: 'Connecting Strava (OAuth) on web',
    body_markdown: `## In the app

Use **Settings** to connect Strava via OAuth. The flow uses scope **\`activity:read_all\`** for activities.

## Production configuration

Deploy **\`VITE_STRAVA_REDIRECT_URI\`** to match your **Strava Authorization Callback Domain** (e.g. \`https://kinetix.bookiji.com/settings\`). **\`STRAVA_CLIENT_SECRET\`** is required server-side for token exchange.

## Local development

Per \`apps/web/STRAVA_OAUTH_SETUP.md\`, you can use **\`VITE_STRAVA_CLIENT_ID\`** and **\`STRAVA_CLIENT_SECRET\`** in \`.env.local\`; locally the redirect often follows **\`window.location.origin\`** so localhost works without setting \`VITE_STRAVA_REDIRECT_URI\`.

**Source:** \`apps/web/STRAVA_OAUTH_SETUP.md\`, \`FEATURES_WEB.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'sync',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-withings-weight-sync',
    title: 'Withings scale connection and weight sync',
    body_markdown: `## Behavior (web)

From **Settings**, connect Withings OAuth. On load, the app refreshes tokens and pulls **about 90 days** of weigh-ins into local weight history; pagination is followed so recent weigh-ins are not cut off.

**Refresh weight** in Settings runs the same merge. **KPS** and run cards resolve **weight-at-date** from that history when an entry exists on/before the run.

**Source:** \`FEATURES_WEB.md\` (Settings bullet), deterministic fallback copy in \`apps/web/src/lib/helpCenterFallback.ts\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'sync',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-garmin-import-formats',
    title: 'Garmin import: ZIP, FIT, and Connect export',
    body_markdown: `## Supported inputs (web)

Settings supports importing:

- A **Garmin Connect export ZIP** (including \`DI_CONNECT/.../summarizedActivities.json\` layout),
- A ZIP containing **\`.fit\`** files only, or
- A single **running** \`.fit\` file.

Imports **merge** into local history with **deduplication**.

**Source:** \`FEATURES_WEB.md\`, \`apps/web/GARMIN_IMPORT.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'import',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-kps-npi-dashboard',
    title: 'KPS / NPI on the web dashboard',
    body_markdown: `## Terminology

The web app surfaces **NPI** (Normalized Performance Index) / **Kinetix Performance Score** branding per \`apps/web/src/lib/branding.ts\`. Scoring uses **age** and **weight** from your profile and run data (\`calculateAbsoluteKPS\` / \`kpsUtils\`).

## Where to look

- **Home** dashboard: best, average, target, recent runs.
- **History** filters and run detail include relative KPS and medals.
- **Menu** (\`/menu\`) has charts including max KPS pace/duration.

**Source:** \`FEATURES_WEB.md\`, \`KPS_CONTRACT.md\` for invariants (shared contract).`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'kps',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-charts-menu-route',
    title: 'Charts and the Menu page',
    body_markdown: `## Route

**Charts** live under **\`/menu\`** (Menu page) with pace/duration and other informative charts as implemented.

Navigation is part of the web shell (\`Layout\`).

**Source:** \`FEATURES_WEB.md\`, \`apps/web/src/App.tsx\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'charts',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-history-filters',
    title: 'Filtering run history',
    body_markdown: `## Capabilities

History supports filters by name text, pace range, duration, distance, relative KPS range, and presets to hide unrealistically fast paces. With filters on, matching runs load **client-side** from full history. With a KPS range filter, the **personal-best reference** run can stay pinned.

**Source:** \`FEATURES_WEB.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'charts',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-platform-limitations-browser',
    title: 'Known web platform limitations',
    body_markdown: `## Current gaps (web)

Per \`FEATURES_WEB.md\`, the **browser** app does **not** include: Apple Watch pairing, HealthKit, real heart rate sensors (HR may be simulated), form metrics/score, voice coaching, haptics, native battery profiles, full background GPS when the tab is inactive, crash recovery, or GPX export — among others.

**Maps:** route points may be recorded but **map visualization** is not implemented on web.

These are **product/reality** limits, not temporary bugs unless a feature ships.

**Source:** \`FEATURES_WEB.md\` Missing Features / Limitations.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'limitation',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-gps-permission-denied',
    title: 'GPS denied or poor on web',
    body_markdown: `## Behavior

Recording uses the **browser Geolocation API**. The UI shows GPS status (e.g. searching/poor/denied). The user must **grant location permission** for the site.

## Limits

Background tabs may **throttle** location updates; tracking can be limited when the tab is not active (\`FEATURES_WEB.md\`).

**Source:** \`FEATURES_WEB.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-login-and-profile-required',
    title: 'Sign-in and platform profile required',
    body_markdown: `## Routing

Main app routes are behind **\`ProtectedRoutes\`** in \`apps/web/src/App.tsx\`. Unauthenticated users are sent to **\`/login\`**. While loading profile/entitlements, the app shows loading states.

**Coach chat** requires a **platform profile** (\`useChat\` throws if profile is missing).

**Source:** \`apps/web/src/App.tsx\`, \`apps/web/src/hooks/useChat.ts\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'account',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-entitlement-required',
    title: 'Entitlement required message',
    body_markdown: `## When it appears

If the user is signed in but **no active \`kinetix\` entitlement** exists in platform access, the app shows **Entitlement required** (\`apps/web/src/pages/EntitlementRequired.tsx\`).

## What it means

Access is gated by **\`platform.entitlements\`** for \`product_key = kinetix\` (\`apps/web/src/lib/platformAuth.ts\`).

**Billing:** When Stripe billing is enabled for the deployment, subscription checkout and webhooks can grant entitlements — see \`docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md\`. If billing is not configured, entitlement issues are an **account/configuration** matter for support.

**Source:** \`apps/web/src/pages/EntitlementRequired.tsx\`, \`apps/web/src/lib/platformAuth.ts\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'account',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-billing-stripe-checkout-overview',
    title: 'Stripe checkout and Kinetix entitlement (when enabled)',
    body_markdown: `## Scope

When **\`BILLING_ENABLED=true\`** and Stripe env vars are set, the API exposes **\`POST /api/billing/create-checkout-session\`** with a Supabase **Bearer** token. Checkout metadata includes **\`product_key=kinetix\`**. Webhooks on the Bookiji side update **\`platform.entitlements\`**.

If billing env is missing, checkout may return **503** — that is a **deployment configuration** issue, not a user bug.

**Source:** \`docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md\`, \`api/billing/create-checkout-session/index.ts\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'billing',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-data-local-storage-privacy',
    title: 'Where web run data lives',
    body_markdown: `## Storage

Runs and settings persist **locally** in the browser (localStorage / IndexedDB patterns per \`FEATURES_WEB.md\` and implementation). **Supabase** may mirror activities for authenticated users depending on sync features.

## Help Center FAQ

Help Center states that run history stays **on device** in the browser unless a feature explicitly syncs to a configured service.

**Source:** \`apps/web/src/pages/HelpCenter.tsx\` FAQ, \`FEATURES_WEB.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'privacy',
    intent: 'policy',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-coach-chat-not-medical',
    title: 'Coach chat is not medical advice',
    body_markdown: `## Product stance

Help Center FAQ states Coach chat is **coaching and analytics assistance**, not medical advice. For health concerns, users should consult a qualified professional.

**Source:** \`apps/web/src/pages/HelpCenter.tsx\` FAQ section.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'policy',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-ai-chat-endpoint',
    title: 'Coach chat uses /api/ai-chat',
    body_markdown: `## Request

\`useChat\` **POST**s to **\`/api/ai-chat\`** with \`systemInstruction\` (including RAG coach context) and \`contents\` message history.

Failures surface as chat errors in the UI.

**Source:** \`apps/web/src/hooks/useChat.ts\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-supabase-env',
    title: 'Supabase environment variables (web client)',
    body_markdown: `## Client

The Vite app expects **\`VITE_SUPABASE_URL\`** and **\`VITE_SUPABASE_ANON_KEY\`** (or publishable key variants documented in \`.env.example\`) for auth and platform profile access.

Misconfiguration causes sign-in or profile load failures.

**Source:** \`apps/web/.env.example\`, \`docs/deployment/ENV_PARITY.md\` (identity parity).`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'account',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-strava-sync-fails-checklist',
    title: 'Strava sync issues: checklist',
    body_markdown: `## Checklist

1. **OAuth** completed in Settings; tokens present.
2. **Redirect URI** in Strava matches deployment (\`STRAVA_OAUTH_SETUP.md\`).
3. **Server secret** \`STRAVA_CLIENT_SECRET\` set where token exchange runs.
4. For **import** behavior, see \`FEATURES_WEB.md\` — Strava activities are fetched from Strava APIs after connect.

Deterministic fallback in Help Center also suggests checking **browser console** only if something still fails after the above.

**Source:** \`apps/web/STRAVA_OAUTH_SETUP.md\`, \`apps/web/src/lib/helpCenterFallback.ts\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'sync',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-empty-support-kb-results',
    title: 'Support search returned no articles',
    body_markdown: `## Meaning

Retrieval succeeded but **\`results\` is empty**. The UI shows **Deterministic fallback** and **retrieval_empty** in escalation payloads.

## Causes

- **No chunks** ingested yet in \`kinetix_support_kb\`.
- Query semantics do not match any chunk (still a product/content issue, not a user error).

**Ingest** approved artifacts via \`POST /support/kb/ingest\`.

**Source:** \`apps/web/src/lib/helpCenterEscalation.ts\`, \`apps/rag/README.md\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-watch-ios-not-web',
    title: 'Apple Watch and iPhone apps vs web',
    body_markdown: `## Scope

Kinetix ships **watchOS** and **iPhone** surfaces in addition to **web**. The **web Help Center** explicitly notes that watch and phone apps are **separate**; web documentation covers the **browser** experience.

**Source:** \`apps/web/src/pages/HelpCenter.tsx\` limitations section, \`docs/WEB_APPS.md\` (web app role).`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'policy',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-indexeddb-strava-sync',
    title: 'IndexedDB and Strava sync errors in browser',
    body_markdown: `## Note

Strava sync code paths use **IndexedDB** (Dexie). In test environments without IndexedDB, sync may log errors. On a normal browser, ensure **site storage** is allowed and not cleared aggressively.

**Source:** \`apps/web/src/lib/strava.ts\` / tests referencing \`IndexedDB API missing\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'sync',
    intent: 'troubleshoot',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-target-npi-settings',
    title: 'Target NPI and Find My Target NPI in Settings',
    body_markdown: `## Features

Settings includes **target NPI** configuration, **Find My Target NPI** from race results, units, physio-pacer mode, data management, and integrations (Strava, Withings, Garmin).

**Source:** \`FEATURES_WEB.md\` Settings section.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'kps',
    intent: 'howto',
    source_type: 'editorial',
  },
  {
    artifact_id: 'web-help-center-quick-prompts',
    title: 'Help Center quick prompts',
    body_markdown: `## UI

Help Center offers one-click **quick prompts** for Strava connection, imports (Garmin/FIT), and KPS/charts — these fill the support search field and run a query.

**Source:** \`QUICK_PROMPTS\` in \`apps/web/src/pages/HelpCenter.tsx\`.`,
    version: 1,
    review_status: 'approved',
    locale: 'en',
    product: 'kinetix',
    surface: 'web',
    topic: 'general',
    intent: 'howto',
    source_type: 'editorial',
  },
]

const outPath = join(__dirname, 'support-artifacts.json')
fs.writeFileSync(outPath, JSON.stringify(ARTIFACTS, null, 2), 'utf8')
console.log(`Wrote ${ARTIFACTS.length} artifacts to ${outPath}`)
