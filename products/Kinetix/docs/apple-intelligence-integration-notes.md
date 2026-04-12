# Apple Intelligence Integration Notes (Repo Inspection)

## Search Keywords Used
- readiness
- fatigue
- recommendations
- coaching
- summary
- watch
- ios

## Existing Deterministic Logic Sources

### watchOS readiness + fatigue
- `watchos/KinetixWatch/LocationManager.swift`
  - `RaceReadinessEngine.compute(from:)` is deterministic and currently computes:
    - readiness score
    - readiness status
    - user-facing readiness message
    - recommended workout passthrough from payload
  - Deterministic factors include fatigue level, load risk, prediction trend, phase alignment, and goal proximity.

### watchOS recommendation engine
- `watchos/KinetixWatch/FormCoach.swift`
  - Rule-based recommendation generation and adaptive outcomes.
- `watchos/KinetixWatch/CoreMLCoach.swift`
  - Model-backed recommendation mapping with deterministic fallback.

### watchOS existing summary surface
- `watchos/KinetixWatch/RunDetailView.swift`
  - `generateCoachAnalysis()` currently produces deterministic post-run notes from run metrics.

### watchOS readiness UI surface
- `watchos/KinetixWatch/HomeView.swift`
  - `RaceReadinessCard` displays readiness score/status/message and suggested workout.

### iOS existing summary surface
- `ios/KinetixPhone/SettingsView.swift`
  - `generateAISummary()` summarizes recent runs from deterministic run data.

## Best Integration Points (Phase-1)

### iOS
1. `SettingsView.generateAISummary()`
   - Add Apple Intelligence post-run summary generation from deterministic aggregates.
   - Keep deterministic summary text as fallback.
2. Readiness explanation + recommendation naturalization
   - Hook to existing deterministic readiness inputs once iOS readiness payload source is exposed similarly to watch readiness snapshot.

### watchOS
1. `HomeView` / `RaceReadinessCard`
   - Add pre-run suggestion text generated from deterministic readiness score + fatigue mapping + recommendation type.
   - Add recovery alert text generated from deterministic fatigue/readiness values.
2. `RunDetailView`
   - Generate Apple Intelligence post-run summary from deterministic run values (distance, pace, HR, KPS, trend).

## Notes / Constraints
- No backend dependency was added.
- Deterministic engines remain unchanged.
- Apple Intelligence availability uses OS check + placeholder hardware capability check for now.
