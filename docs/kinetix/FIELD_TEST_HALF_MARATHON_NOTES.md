# Field Test Half-Marathon Notes

## Observed UI Issues
- **KPS Scoring:** A long slow run received an absolute KPS that exceeded previous faster, shorter runs due to the exponential Riegel model (`distanceKm ^ 1.06`), making it the new KPS PB.
- **Ambiguous Text:** The UI displayed "Personal best" ambiguously, leading to confusion between "Longest distance" and "Highest relative KPS performance".
- **Live Pace Clipping:** Paces like `10:17/km` clipped or displayed an ellipsis (`...`) because the text container was set to truncate or fixed width in `RunStatsPanel`.
- **Heart Rate States:** Live HR defaulted to `--` or `70` instead of distinct connection states.

## Fixes Implemented
- **Achievement Labels System:** Differentiated distinct achievement labels: `KPS PB`, `Longest distance`, `First half marathon`, `First marathon` to properly credit long runs without confusing users. Replaced "Personal best".
- **Live Pace UI:** Removed CSS text truncation (`truncate`, `text-ellipsis`) from `RunStatsPanel` and allowed the text to wrap/scale responsively (`text-lg sm:text-xl`).
- **HR States UI:** Implemented `getHeartRateDisplayState` helper function to default missing values to `No HR`. Future integration will provide `Finding HR`, `Enable HR`, etc.

## Goal-Aware HUD Requirements (Foundation Added)
A foundation for goal-aware pacing was added in `@kinetix/core`.
- **Modes Added:** `free_run`, `half_marathon`, `marathon_6h`, `beat_recent_distance_at_recent_pace`.
- **Calculations Provided:** Target distance/time, remaining distance/time, required remaining pace.

## KPS Kilometer Marker Requirement (Foundation Added)
- **Model:** Added `KpsMarker` interface (`kmIndex`, `elapsedSec`, `splitSec`, `avgPaceSecPerKm`, `liveKps`, `distanceKm`, `createdAt`).
- **Capture Logic:** Created a `captureKpsMarker` pure function to capture stats exactly on kilometer boundaries (e.g. 1.0, 2.0) and prevent duplicates.

## Known Future Items
- Incorporate altitude/elevation in pacing.
- Temperature adjustments for KPS.
- Background-safe GPS and run tracking on iOS.
- Supporter messages logic during long races.
- Incorporating native device sensor statuses (Finding HR, Enable HR) into the PWA.
