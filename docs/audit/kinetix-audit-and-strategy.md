# Kinetix System Audit & Winning Strategy

## 1. Audit Summary

The Kinetix platform establishes a strong, foundational performance metric in the Kinetix Performance Score (KPS). It successfully abstracts distance, age, and weight through strict invariants (e.g., using Riegel's formula) allowing cross-runner comparability without complex physiological jargon. The architecture correctly separates core deterministic logic (`@kinetix/core`) from localized caching (Dexie in the web app) and native UI elements (SwiftData/HealthKit on iOS).

However, the platform has critical state management bugs concerning the "Best Recent" concept vs "Latest" KPS. The physiological data collection is currently constrained strictly to post-run pacing/distance summaries rather than leveraging live systemic readiness (HRV, Sleep) or running mechanics, which Garmin and Whoop dominate.

## 2. Critical Bugs

- **KPS Dashboard Mismatch:** The `RunDashboard` component assigns `homeSummary.latestKps` to the most recent run’s KPS and displays it as the Hero metric when idle. However, the requirement/memory states the Hero KPS should display the **best relative KPS among recent runs** (`referenceKps`), using `calculateBestRecentRelativeKPSSync`. The `latestKps` property in `DirectionalHomeSummary` should be replaced with `referenceKps`.
- **Beat Recent Calculation:** In `RunDashboard.tsx`, the `beatRecentsCount` logic manually loops over runs calling `calculateAbsoluteKPS` without using the canonical centralized `kpsUtils` helper (`calculateBestRecentRelativeKPSSync` equivalent or similar centralized function).
- **Missing Hook Context:** Failing test indicating `KinetixCoachingContextProvider is required for this hook.` in `apps/web` which might lead to crashed app states when caching or accessing coaching routes.

## 3. Test Gaps

- **KPS Consistency Across Views:** No integration tests exist to assert that the `Hero KPS` on the Dashboard matches the `Best Recent KPS` logic. Tests only assert that "a KPS" is shown.
- **Live vs Final KPS Divergence:** The `RunDashboard` test suite lacks coverage verifying the transition between the rolling-window live KPS calculation and the final full-activity cumulative KPS upon run completion.
- **Multi-source Ingestion Deduplication:** No robust testing for Strava sync logic verifying that `external_id` deduplication correctly updates existing records vs creating duplicates under high concurrency.
- **Physiological Edge Cases:** Lacking tests for very short runs (<2km), paused runs, or massive pacing spikes that might skew the KPS Riegel normalizations.

## 4. Physiology Gaps vs Market Leaders

### What Kinetix Has:
- **Core Normalization:** Age, weight, and distance normalized scoring via KPS.
- **Simple Direct Coaching:** "Protect KPS", "Build KPS" directional text.

### What is Missing (and why it matters):
1. **Aerobic System:** Missing VO2 Max estimation. KPS acts as a surrogate but lacks physiological grounding in oxygen consumption, preventing precise sub-maximal training targeting.
2. **Threshold Systems:** No Lactate Threshold detection. Distinguishing between a Tempo run and a Threshold run is impossible without HR/Lactate data, which Coros/Garmin do natively.
3. **Neuromuscular:** Missing Cadence and Running Economy signals. Pacing alone doesn't reveal *how* the speed was achieved (stride length vs turnover).
4. **Fatigue & Recovery:** Missing HRV integration. The current system relies on self-reported readiness or external Garmin syncing (if built). Acute vs. Chronic load is implied via KPS but not modeled systemically like Whoop's Strain/Recovery.
5. **Biomechanics:** Missing Ground Contact Time (GCT) and Vertical Oscillation (VO). Without FIT ingestion, form breakdowns during fatigue cannot be detected.
6. **Real-time Physiology:** Missing live Cardiac Drift detection to adjust live KPS pacing guidance.

## 5. Top 10 Features to Build

*Ranked by Impact, Complexity, and Dependency*

1. **HRV / Nightly Sleep Ingestion (High Impact, Low Complexity, Dep: Apple Health/Withings)**
   - Correlate systemic recovery to KPS readiness thresholds.
2. **Acute vs. Chronic Training Load (High Impact, Med Complexity, Dep: None)**
   - Use exponential weighted moving averages of KPS-weighted distance to warn of overtraining.
3. **Heart Rate-Weighted KPS (High Impact, High Complexity, Dep: FIT file parser)**
   - Adjust KPS up if achieved at a lower average HR (improved running economy).
4. **Live Cardiac Drift Detection (High Impact, High Complexity, Dep: Apple Watch Live API)**
   - If HR climbs while pace remains static, trigger "Fatigue Onset" alerts to slow down.
5. **Cadence & Stride Length Tracking (Med Impact, Med Complexity, Dep: Apple Health/Garmin)**
   - Identify neuromuscular breakdowns late in long runs.
6. **Lactate Threshold Estimation (Med Impact, High Complexity, Dep: HR + Pace arrays)**
   - Identify the inflection point in HR vs Pace to auto-update pacing zones.
7. **VO2 Max Surrogate Mapping (Med Impact, Low Complexity, Dep: None)**
   - Map maximum KPS directly to a physiological VO2 Max equivalent for easier cross-platform comparison.
8. **Temperature/Elevation Normalization (Low Impact, Med Complexity, Dep: Weather API / MapKit)**
   - Adjust KPS penalty for running in high heat/humidity or massive elevation gain.
9. **Form Power / Running Effectiveness (Low Impact, High Complexity, Dep: FIT parsing)**
   - Ratio of speed to power output (if power meters like Stryd/Coros are ingested).
10. **Recovery Gate Interventions (Med Impact, Med Complexity, Dep: Apple Watch/Health)**
    - Auto-downgrade the day's "Target KPS" if sleep drops below a threshold before the runner even wakes up.

## 6. Strategic Direction (Winning Strategy)

### Core Differentiator
Kinetix wins by translating complex, overwhelming physiological data into a **single, democratized, and actionable directional metric (KPS)**. While Garmin and Whoop provide raw data (HRV, GCT, VO2 Max), they put the cognitive burden on the user to interpret it. Kinetix acts as the translation layer: "Your HRV is low, therefore your Target KPS today is reduced. Run Easy."

### The "Unfair Advantage"
- **Cross-Distance Normalization:** Competitors struggle to compare a 5K to a Marathon. KPS is already built to do this inherently.
- **Simplicity vs Overload:** Real-time coaching decisions (via AI and strict gating) instead of dashboards full of graphs. Tell the user *what to do*, not just *what happened*.

### What NOT to Build
- **Do NOT build custom optical HR or HRV hardware algorithms.** Rely entirely on HealthKit/Garmin for raw signals.
- **Do NOT build a social network feed.** Strava owns this. Keep Kinetix purely focused on personal physiological progression.
- **Do NOT clutter the UI with raw scientific metrics.** Do not show "Vertical Oscillation = 8.4cm". Instead, show: "Form breaking down—increase cadence."

## 7. Immediate Next 5 Actions

1. **Fix the KPS Mismatch Bug:** Refactor `RunDashboard.tsx` and `directionalHomeSummary.ts` to use `referenceKps` (best recent) instead of `latestKps` for the Hero display, utilizing a centralized `calculateBestRecentRelativeKPSSync` helper.
2. **Implement FIT File Parsing / Apple Health HR Ingestion:** Prioritize the backend pipeline to accept time-series Heart Rate data to unlock Cardiac Drift and HR-weighted KPS.
3. **Build the Acute/Chronic Load Model:** Add a derived table in IndexedDB to calculate the rolling 7-day vs 28-day KPS-weighted volume to power the Fatigue intelligence engine.
4. **Write KPS Consistency Integration Tests:** Add playwright/vitest assertions strictly verifying the Hero KPS matches the History page's "Best Recent" calculation.
5. **Deploy the "Recovery Gate":** Finalize the MultiSignalCoachingEngine on the iOS/Watch apps to auto-adjust the daily `ActivityTemplate` based on the morning's Sleep/HRV pull.
