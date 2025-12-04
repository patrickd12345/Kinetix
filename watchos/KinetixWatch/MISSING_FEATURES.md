# Enhancement Backlog (Non-Critical)

> This file now tracks **future-facing enhancements** only. Critical gaps called out in earlier audits (pause/resume, crash recovery, GPS/HealthKit error handling, user-facing alerts, and run validation) are already implemented in `LocationManager.swift` and surfaced in `RunView.swift`.

## Resolved Since Last Backlog Draft

- Pause/resume controls with UI affordances
- Periodic autosave + crash recovery flow
- GPS quality monitoring with user-facing alerts
- HealthKit authorization messaging and graceful degradation
- Invalid run validation (distance/time thresholds)

## Active Enhancement Ideas

### 1. Auto-Pause on Stop
- Detect stopped movement and pause automatically.
- Resume when movement resumes (configurable sensitivity).

### 2. Dedicated Recovery UI
- Present a richer "Resume Run" screen with partial stats instead of a simple alert.
- Allow discarding or resuming with context (distance, elapsed time, last GPS lock quality).

### 3. Export/Share Runs
- Add GPX/TCX export support.
- Share sheets for sending runs to other apps/services.

### 4. Onboarding & Tutorial
- First-run walkthrough explaining NPI, feedback cues, and presets.
- Link to detailed docs for form coaching and battery profiles.

### 5. Battery Optimization Warnings
- Surface reminders when aggressive sampling is active during long runs.
- Suggest switching to Balanced/Eco profiles based on estimated remaining time.






