# Bolt's Journal

## 2024-05-22 - [Project Start]
**Learning:** Initial setup of the journal.
**Action:** Always check for this file before starting work.

## 2024-05-22 - [Excessive Timer Frequency]
**Learning:** Found `useLocationTracking` updating state at 10Hz (100ms) for a UI showing only seconds.
**Action:** Always check `setInterval` frequencies against the actual UI update requirements. 1Hz is enough for HH:MM:SS.
