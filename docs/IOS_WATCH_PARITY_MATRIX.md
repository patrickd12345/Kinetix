# Web to iPhone + watchOS Parity Matrix

Source of truth: web app ([RunDashboard](apps/web/src/pages/RunDashboard.tsx), [History](apps/web/src/pages/History.tsx), [Settings](apps/web/src/pages/Settings.tsx)). This matrix maps each web behavior to iPhone and watch status.

| # | Web behavior | iPhone | Watch | Priority |
|---|--------------|--------|-------|----------|
| **Run** |
| R1 | Start / pause / resume / stop run | Partial (mirrors watch) | Implemented | P0 |
| R2 | Live distance, duration, pace, KPS | Partial (metrics from watch) | Implemented (as NPI) | P0 |
| R3 | Target KPS and progress / time-to-beat | Partial | Implemented (target NPI) | P0 |
| R4 | Heart rate (Physio mode) | Implemented (Dashboard) | Implemented | P0 |
| R5 | Beat PB modal: time/distance options, pace, configurable % | Missing | N/A | P1 |
| R6 | Post-run AI analyze (single run) | Partial (AICoach in detail) | N/A | P1 |
| R7 | User-facing label: KPS (not NPI) | Missing (shows NPI) | Missing (shows NPI) | P0 |
| **History** |
| H1 | Paginated run list | Implemented (SwiftData list) | N/A | P0 |
| H2 | Relative KPS / PB baseline (PB = 100) | Missing | N/A | P1 |
| H3 | Trend chart with date range / zoom | Missing | N/A | P2 |
| H4 | PB marker (green dot) in list/chart | Missing | N/A | P2 |
| H5 | Hide/delete run (logical delete) | Missing | N/A | P1 |
| H6 | Run detail: expand, AI analyze, export | Partial (detail + export) | N/A | P1 |
| H7 | Calendar / date jump | Missing | N/A | P2 |
| **Settings** |
| S1 | Target KPS | Implemented (target NPI) | Implemented | P0 |
| S2 | Unit system (metric / imperial) | Implemented | Implemented | P0 |
| S3 | Physio mode (HR) | Implemented | Implemented | P0 |
| S4 | Beat PB target % | Missing | N/A | P1 |
| S5 | Strava connect / import | Partial (export) | N/A | P1 |
| S6 | Garmin ZIP import | Missing | N/A | P1 |
| S7 | Withings connect / weight source | Missing | N/A | P1 |
| S8 | Outlier prompt after import (hide/keep) | N/A | N/A | P1 |
| S9 | RAG reindex action | Missing | N/A | P2 |
| S10 | Profile / identity display | Partial (profile section) | N/A | P1 |
| **Auth / access** |
| A1 | Login gate (unauthenticated → login) | N/A (no Supabase on device) | N/A | P2 |
| A2 | Entitlement gate (no access without kinetix) | N/A | N/A | P2 |
| **Terminology** |
| T1 | Product name: Kinetix (no legacy names) | Implemented | Implemented | P0 |
| T2 | Metric label: KPS in UI | Missing (NPI used) | Missing (NPI used) | P0 |

**Legend**
- **Implemented**: Behavior matches web intent.
- **Partial**: Some aspects done; gaps noted.
- **Missing**: Not present on platform.
- **N/A**: Not applicable (e.g. watch has no Settings import).

**Priority**
- P0: Must align for parity refresh (terminology, core run/settings).
- P1: High value; add or document as deferred.
- P2: Nice to have; can defer.

---

## Parity refresh report (completed)

After implementing the iPhone + watchOS parity refresh:

**Done**
- **Terminology (T1, T2, R7)**: All user-facing labels now use "KPS" (and "Kinetix" preset name) on watch and iPhone. Internal identifiers (e.g. `targetNPI`, `avgNPI`) unchanged for data/sync compatibility.
- **Watch runtime**: ActivityTemplate display names and screen labels use KPS; progress gauge and run UI use KPS. Legacy "MeBeatMe" decode in `WorkoutConfig` preserved for stored data.
- **iPhone companion**: History, Home, RunTracking, Settings, and Strava export show KPS. Dashboard/connectivity unchanged; sync preserves run state and metrics.
- **Docs**: LOCATION_MANAGER_GUIDE, MISSING_FEATURES, ADAPTIVE_LEARNING, FEATURES_IMPLEMENTED updated for KPS naming and active targets (watchos/KinetixWatch, ios/KinetixPhone).

**Repo checks**
- `pnpm lint`, `pnpm type-check`, `pnpm test`: all passed (web + core; Swift/iOS build not run in this pipeline).

**Intentionally deferred**
- Beat PB modal, RAG reindex, Withings/Garmin import, outlier prompt, trend chart, PB marker, hide run, and auth/entitlement gating on device: see matrix (P1/P2). Manual smoke testing of run lifecycle, history, and settings on device recommended before release.
