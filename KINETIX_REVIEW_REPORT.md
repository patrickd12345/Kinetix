# Kinetix Full Pre-Production Review

## 1. Executive Summary

This report is a holistic, pre-production review of the Kinetix monorepo (`apps/web`, `api/`, `apps/rag`, `monorepo-packages/`, `packages/`, etc.). I have evaluated correctness, security, data integrity, performance, accessibility, and maintainability.

The core architecture, including the Dexie IndexedDB implementation, relative KPS calculations (`getPB()`), and shared Supabase platform spine, is structurally sound. However, there are significant pre-production risks. Critical issues include insecure storage of OAuth refresh tokens in local storage, fragile UI data deletion that orphans personal best records (PB), missing logic for transactionally saving runs alongside RAG indexing, and potentially problematic security overrides in the API that need absolute verification they cannot reach production.

Performance currently suffers from a monolithic main chunk that defeats route-level lazy loading. E2E coverage is strong for smoke testing, but unit/component coverage on high-complexity screens (like Settings and the Run Dashboard) is critically low.

## 2. Critical Findings

### 2.1 P1 - XSS/Blast Radius via OAuth Token Storage
*   **Severity**: Critical
*   **Exact file/path**: `apps/web/src/store/settingsStore.ts`
*   **Concrete problem**: The Zustand store persists `withingsCredentials`, `stravaCredentials`, and legacy `stravaToken` in plaintext via browser `localStorage`.
*   **Why it matters**: A single XSS vulnerability would allow attackers to steal long-lived OAuth refresh tokens for third-party platforms (Strava, Withings), drastically increasing the blast radius.
*   **Recommended fix**: Migrate third-party token persistence to the secure Supabase backend (e.g., within `providerConnections` or the platform profile). The client should proxy requests through `api/` or retrieve short-lived tokens on demand, never persisting refresh tokens locally.

### 2.2 P1 - Broken Data Deletion Semantics (Orphaned PBs)
*   **Severity**: Critical
*   **Exact file/path**: `apps/web/src/pages/History.tsx`
*   **Concrete problem**: The UI directly calls `db.runs.delete(id)` for run deletion, whereas the underlying data model uses a logical delete via `hideRun(runId)` in `database.ts` (which also clears stale PB records).
*   **Why it matters**: Hard-deleting a run that is the current Personal Best leaves `db.pb` pointing to a missing run. This corrupts the baseline for relative KPS computation (`(run/pb)*100`), potentially breaking all historical score displays.
*   **Recommended fix**: Change `db.runs.delete` in `History.tsx` to `hideRun(id)`. Ensure all deletions flow through the centralized data integrity layer.

### 2.3 P1 - Untransactional Run Save & Indexing
*   **Severity**: Critical
*   **Exact file/path**: `apps/web/src/store/runStore.ts`
*   **Concrete problem**: `persistStoppedRun` saves the run asynchronously, checks/updates the PB, and indexes it in the RAG vector store without a transaction or rollback mechanism.
*   **Why it matters**: If RAG indexing fails, the run exists in Dexie but is invisible to the AI Coach. If PB update fails, the UI falls out of sync with stored history.
*   **Recommended fix**: Wrap the Dexie `add` and `checkAndUpdatePB` inside a single `db.transaction`. Handle RAG indexing failures with a robust retry queue or background sync instead of fire-and-forget.

### 2.4 P1 - Missing Protocol Sanitization in Support UI
*   **Severity**: Critical
*   **Exact file/path**: `apps/web/src/pages/SupportQueue.tsx`
*   **Concrete problem**: `ReactMarkdown` renders `href` links from queue/KB content. `sanitizeMarkdownLinkHref` is used, but if not strictly filtering for `http`/`https`/`mailto`, it can allow `javascript:` URIs.
*   **Why it matters**: Support operators view untrusted user data. A malicious ticket could execute XSS against a support operator.
*   **Recommended fix**: Ensure `sanitizeMarkdownLinkHref` explicitly rejects `javascript:` and `data:` URIs, strictly allowing only safe protocols.

## 3. High Findings

### 3.1 P2 - Strava Sync Missing External ID Deduplication
*   **Severity**: High
*   **Exact file/path**: `apps/web/src/lib/strava.ts`
*   **Concrete problem**: `syncStravaRuns` deduplicates incoming runs by matching `source === 'strava'` and comparing derived/rounded values instead of the definitive external Strava `activity.id`.
*   **Why it matters**: Date precision drift or hard-deleted runs will cause duplicate Strava runs to be ingested.
*   **Recommended fix**: Store the external provider ID (e.g., `strava_id`) on the `RunRecord` and deduplicate explicitly against that identifier.

### 3.2 P2 - Defeated Route-Level Lazy Loading
*   **Severity**: High
*   **Exact file/path**: `apps/web/src/App.tsx` and `apps/web/src/pages/History.tsx`
*   **Concrete problem**: `Coaching.tsx` is dynamically imported in `App.tsx` but is statically imported somewhere inside `History.tsx`.
*   **Why it matters**: This forces Vite to bundle `Coaching.tsx` and its heavy dependencies (potentially AI/RAG models and UI) into the initial 845.75 kB main chunk, heavily degrading Time to Interactive (TTI) on mobile devices.
*   **Recommended fix**: Convert the static import in `History.tsx` to a dynamic `React.lazy` import, or refactor shared components out of `Coaching.tsx` so the route itself can be code-split.

### 3.3 P2 - Master Access Bypass Verification
*   **Severity**: High
*   **Exact file/path**: `api/_lib/supportOperator.ts`
*   **Concrete problem**: Development bypass `vite-skip-auth-bypass` is permitted when `MASTER_ACCESS` is true. `MASTER_ACCESS` attempts to throw if `NODE_ENV === 'production'`.
*   **Why it matters**: If `NODE_ENV` is inadvertently misconfigured or not strictly set to `'production'` in the Vercel deployment, the auth bypass could be exposed to the internet.
*   **Recommended fix**: Ensure pre-commit/deployment parity checks strictly validate that `KINETIX_MASTER_ACCESS` is stripped or disabled in production pipelines, relying on `VERCEL_ENV === 'production'` as an additional safety guard.

### 3.4 P2 - Irreversible, Inaccessible History Deletion
*   **Severity**: High
*   **Exact file/path**: `apps/web/src/pages/History.tsx`
*   **Concrete problem**: The delete button is an icon-only control (Trash2) without an `aria-label` or confirmation prompt.
*   **Why it matters**: Fails WCAG accessibility guidelines. Users can accidentally delete runs permanently (especially considering the P1 bug above that hard-deletes).
*   **Recommended fix**: Add `aria-label="Delete run"`, and implement a confirmation dialog before deletion.

## 4. Medium Findings

### 4.1 P3 - Synchronous/Blocking DB Reads on Render
*   **Severity**: Medium
*   **Exact file/path**: `apps/web/src/pages/History.tsx`, `apps/web/src/pages/Menu.tsx`
*   **Concrete problem**: Some views and charts rely on `toArray()` or large unfiltered bulk reads of the run history.
*   **Why it matters**: For power users with years of data, full table scans in Dexie block the main thread and slow down rendering.
*   **Recommended fix**: Implement cursor-based pagination or bounded date queries (e.g., `getRunsInDateRange`) for charts and filters.

### 4.2 P3 - Incomplete API Negative Testing
*   **Severity**: Medium
*   **Exact file/path**: `api/` (Various handlers)
*   **Concrete problem**: Missing explicit unit tests asserting that unauthorized requests (missing tokens, bad scopes) correctly return HTTP 401/403.
*   **Why it matters**: Security regressions during refactoring might accidentally open endpoints.
*   **Recommended fix**: Add uniform negative tests for all Vercel handlers in the `api/` directory.

### 4.3 P3 - Form Controls Lacking Labels
*   **Severity**: Medium
*   **Exact file/path**: `apps/web/src/components/KinetixGoalProgressCard.tsx`
*   **Concrete problem**: Select/input controls rely on visual proximity rather than programmatic `id`/`htmlFor` associations.
*   **Why it matters**: Screen readers cannot announce the purpose of these inputs.
*   **Recommended fix**: Associate explicitly with `<label htmlFor="id">`.

## 5. Low Findings

### 5.1 P4 - Flaky Third-Party API Retries
*   **Severity**: Low
*   **Exact file/path**: `apps/web/src/lib/strava.ts`
*   **Concrete problem**: Encounters synchronous stalls/retries on 429 Rate Limits from Strava.
*   **Why it matters**: Background syncs shouldn't block the UI thread or cause timeouts.
*   **Recommended fix**: Fail fast on 429 and queue for background retry, or immediately show a toast and exit the sync loop.

### 5.2 P4 - Over-reporting Weight History Inserts
*   **Severity**: Low
*   **Exact file/path**: `apps/web/src/lib/database.ts` (`bulkPutWeightEntries`)
*   **Concrete problem**: Reports `count: entries.length` even when overwriting existing records by timestamp.
*   **Why it matters**: Minor UI inaccuracy on sync summaries.
*   **Recommended fix**: Filter or count actual new insertions if the UI relies on an accurate diff.

## 6. Missing Opportunities & Gaps

*   **Missing Test Coverage**: Critical complexity screens like `Settings.tsx` (0.13% coverage) and `RunDashboard.tsx` (panels 2.46% coverage) are virtually untested at the unit/component level. The entire manual/OAuth import flow relies solely on coarse E2E smoke tests.
*   **Dead Code / Obsolete Paths**: `History.tsx` retains old `run.kps` checks and hard-delete pathways that bypass the new `database.ts` abstractions (`hideRun`).
*   **Performance Smell**: Lighthouse CI is disabled due to a broken placeholder URL in `lighthouserc.json`.
*   **Accessibility Gap**: Inconsistent focus rings. `Chat.tsx` overrides `focus:outline-none` with simple border colors instead of the standard `shell-focus-ring` class.
*   **Missing Integrations/Consistency**: Raw provider events (`appendProviderRawEvents`) use `bulkAdd` which throws on duplicate IDs, pushing the deduplication burden to the caller rather than handling it gracefully via `bulkPut` or `add` catches.

## 7. Recommended Next-Action Plan (Ordered by Impact)

1.  **Fix Deletion Semantics (Critical)**: Immediately replace `db.runs.delete` in `History` with `hideRun` to stop the corruption of PB indexes. Add accessibility labels and confirmation to the delete button.
2.  **Secure OAuth Tokens (Critical)**: Refactor `settingsStore.ts` to stop storing `stravaCredentials` and `withingsCredentials` in `localStorage`.
3.  **Harden Markdown Links (Critical)**: Audit `sanitizeMarkdownLinkHref` to strictly drop `javascript:` payloads in the Support Queue.
4.  **Transaction Boundaries (Critical)**: Refactor `persistStoppedRun` in `runStore.ts` to ensure PB recalculations are atomic with run insertions.
5.  **Restore Lazy Loading (High)**: Remove the static import of `Coaching.tsx` in `History.tsx` to drastically reduce the initial JS bundle size.
6.  **Fix Strava Deduplication (High)**: Implement explicit Strava ID checking during ingestion.
7.  **Increase Component Test Coverage**: Write tests for the `Settings` page and `RunDashboard` state transitions.