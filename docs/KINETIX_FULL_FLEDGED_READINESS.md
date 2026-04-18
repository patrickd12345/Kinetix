# Kinetix full-fledged product readiness (KX-FEAT-001)

**Scope:** Kinetix web app (`apps/web`, package `@kinetix/web`) — primary product surface in this monorepo. **Not** a final closure: this is the readiness pass before a formal closure review.

**Branch:** `cursor/kinetix-readiness-8210`  
**Date:** 2026-04-18

## Current product status (web)

- **MVP-demo-ready (web):** Core shell, run dashboard, history, coaching, chat, settings, help, billing return routes, and operator/support surfaces load with defined loading, empty, and error patterns in key flows; automated e2e covers most shell routes; KPS (relative) display is capped to **100** to match the PB=100 product contract; production builds do not honor `VITE_SKIP_AUTH` (auth bypass is dev-only at runtime, fail-closed in production).

- **Gaps (documented, not “done”):**
  - **iOS / watchOS:** Not re-audited in this pass (native runbooks exist under `docs/audit/`, `ios/`, `watchos/`).
  - **RAG / optional services:** RAG and AI keys remain environment-dependent; degraded behavior (banners, errors) is expected if services are down.
  - **History with active filters:** Client-side KPS-bounds filtering can load the full run list in memory to guarantee correct filtering — acceptable for typical volumes; very large local databases may need a future server-side or chunked filter strategy.
  - **Entitlements:** Fails **closed** when platform entitlements table schema is incompatible (warn + deny); this is correct for security but can block access until schema/RLS alignment.

## Routes audited (web, `App.tsx` + `Layout`)

| Route | Load | Empty / guidance | Loading | Error / blocked | Mobile notes |
|-------|------|------------------|--------|-----------------|-------------|
| `/` (Run dashboard) | Yes | “Baseline pending” / coaching cards | Profile / summary loading | Home summary `error` surface | Primary nav + overflow “More” |
| `/login` | Yes | Magic link + OAuth | Auth loading | Supabase / network errors (Login page) | Form usable at narrow widths |
| `/history` | Yes | Empty history copy; filters | First-load + chart loading | Filter / KPS resolution messaging | List + pagination (default 20) |
| `/coaching` | Yes | Blocked/empty per cards | Per-card | Card-level errors where implemented | e2e strict heading + subsections |
| `/menu` (charts hub) | Yes | Chart empty states (per sub-pages) | Lazy | — | e2e mobile |
| `/chat` | Yes | — | — | API errors in UI | e2e smoke |
| `/settings` | Yes | Outlier / import result messages | Importing / reindex | Import errors; OAuth errors | e2e toggles |
| `/help` | Yes | Search + KB | — | Network / RAG (help flow) | a11y e2e |
| `/weight-history` | Yes | Per page patterns | — | — | In shell nav |
| `/operator` | Yes | No-data states in dashboard | — | 403/empty | Lazy route |
| `/support-queue` | Yes | Empty queue | — | Auth / API | Lazy route |
| `/billing/success` | Yes | — | — | — | e2e crawl |
| `/billing/cancel` | Yes | — | — | — | e2e crawl |

> Automated coverage: `apps/web/e2e/*.spec.ts` (Kinetix audit crawl, internal links, shell, help, operator + queue smoke, etc.).

## Improvements made (this pass)

1. **KPS display safety (contract):** User-facing **relative** KPS from `calculateRelativeKPS` / `calculateRelativeKPSSync` is **capped at 100** (`kpsDisplayPolicy.ts`, used from `kpsUtils.ts`, live KPS display, `RunDetails`, `KPSTrendChart` Y-domain). Rationale: PB=100; raw ratios above 100 can appear when PB metadata is stale or profile drifted — the UI must not show impossible headline scores. Added contract test: faster non-PB run vs slow PB → **100**.
2. **Live KPS:** `getLiveKpsDisplayState` applies the same cap; unit test for values > 100.
3. **Run dashboard:** Hero / AI analysis path uses **capped** KPS for display.
4. **Settings outlier dialog:** Stopped showing **raw absolute** KPS (misleading per `KPS_CONTRACT.md`). Now shows **relative KPS to current PB** (or “—” while resolving), with clearer copy. Uses batch weight fetch + `calculateRelativeKPSSync` (no per-run N+1 to weights).
5. **Production safety:** `VITE_SKIP_AUTH` is **disabled in production builds** (`AuthProvider`); `.env.example` comment updated. Aligns with “dev-only tools gated; production fail closed.”
6. **E2E reliability:** `heavy-user-fixture.spec.ts` used `getByRole('heading', { name: 'Coaching' })` which matched multiple headings; fixed with **`exact: true`** to avoid strict-mode violation.
7. **KPS trend chart:** Y-axis domain aligned to **0–100** (was 0–120), matching the display contract.

## Remaining MVP-level gaps (honest)

- **Data at scale:** Users with very large local run histories may see heavier client work on filter-all mode and PB initialization (full visible runs scan) — still bounded by device storage but not by a hard row cap in all paths.
- **Native apps:** No code changes in this pass; closure should include watchOS + iOS parity review if still in scope.
- **Third-party / AI:** Quality of coaching and help answers depends on configured models and RAG; not a substitute for product completeness of **features**, only **explanations**.

## Production blockers (to verify at closure)

- **Required env for real auth and profile:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or the `NEXT_PUBLIC_*` equivalents in `.env.example`).  
- **Entitlements / Stripe:** See `docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md` and `docs/deployment/ENV_PARITY.md` — server-side and platform DB must be aligned or users see `EntitlementRequired` / errors (by design, fail closed).
- **RAG (optional):** `VITE_RAG_SERVICE_URL` and running RAG service for full indexing/Help Center; otherwise degraded UX.
- **No `VITE_MASTER_ACCESS` in production** — `apps/web/src/lib/debug/masterAccess.ts` already throws in prod if set.

## Environment variables (web — see `apps/web/.env.example`)

- **Core:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_*` variants)  
- **Auth providers (optional):** `VITE_AUTH_GOOGLE_ENABLED`, `VITE_AUTH_APPLE_ENABLED`, `VITE_AUTH_MICROSOFT_ENABLED`  
- **Auth redirect:** `VITE_AUTH_REDIRECT_URL` as needed for OAuth/magic link  
- **Dev-only (ignored in production build for skip-auth):** `VITE_SKIP_AUTH=1`  
- **Audit only (non-prod):** `VITE_MASTER_ACCESS=1`  
- **RAG / Help / Support:** `VITE_RAG_SERVICE_URL`, `VITE_HELP_CENTER_AI_URL`, operator/support vars as in `.env.example`

## Commands run (evidence)

From repo root (`/workspace`):

1. `pnpm install` — success.  
2. `pnpm --filter @kinetix/web lint` — success.  
3. `pnpm type-check` (root) — success.  
4. `pnpm --filter @kinetix/web test` (Vitest) — **99 files, 433 tests passed.**  
5. `pnpm --filter @kinetix/web build` — success (Vite build + bundle budget).  
6. `cd apps/web && pnpm exec playwright install chromium` — success.  
7. `cd apps/web && pnpm test:e2e` — **44 passed** (after e2e heading selector fix).  

## Test results summary

| Check | Result |
|-------|--------|
| ESLint (web + core) | Pass |
| Typecheck (root + web) | Pass |
| Vitest (web) | 433 passed |
| Playwright (web) | 44 passed |
| Vite production build | Pass |

## Recommended final closure checklist (next phase)

- [ ] Re-run full **native** manual runbook: `docs/audit/KINETIX_NATIVE_AUDIT_RUNBOOK.md`  
- [ ] Staging smoke with **real** Supabase + entitlements + Stripe test mode: `docs/deployment/KINETIX_VERIFICATION_CHECKLIST.md`  
- [ ] Verify **no** `VITE_SKIP_AUTH` in production host env; confirm production bundle does not activate skip-auth (this pass: gated in `AuthProvider`).  
- [ ] Run **Lighthouse** / CWV on production URL (optional: `lh:ci` script).  
- [ ] Product review: NPI vs KPS naming in customer-facing copy (web branding uses KPS; README still mixes concepts in places).  
- [ ] File sign-off: update `REPO_STATUS.md` or `docs/KINETIX_SCOPE_CLOSURE.md` when the formal closure is executed.

## Recommendation

**Ready for a formal “closure pass” (web)**: Core flows, KPS display rules, production auth bypass, automated regression (unit + e2e), and build are in good shape for a demo / staging freeze. **Not “product closed”** until native surfaces and live staging verification are complete.
