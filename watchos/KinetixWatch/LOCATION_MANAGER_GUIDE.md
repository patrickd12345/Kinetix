# LocationManager - What It Does

## Overview
`LocationManager` is currently a **945-line "god object"** that handles way too many responsibilities. Here's what it's doing:

## Responsibilities (Too Many!)

### 1. **GPS Tracking** (~150 lines)
- Manages `CLLocationManager`
- Tracks location updates
- Monitors GPS accuracy and status
- Handles GPS authorization
- Detects GPS signal loss
- Builds route coordinates

### 2. **HealthKit Workout Sessions** (~100 lines)
- Creates and manages `HKWorkoutSession`
- Manages `HKLiveWorkoutBuilder`
- Collects heart rate data
- Handles workout state changes
- Saves workouts to HealthKit

### 3. **Run State Management** (~150 lines)
- Start/pause/resume/stop runs
- Tracks elapsed time (accounting for pauses)
- Manages run timers
- Handles crash recovery
- Saves/loads recovery data

### 4. **Metrics Calculation** (~100 lines)
- Calculates NPI (Normalized Performance Index)
- Calculates pace
- Calculates distance
- Rolling 5-second pace average
- Progress gauge for "MeBeatMe" preset

### 5. **Watch Connectivity** (~100 lines)
- Manages `WCSession` for iPhone communication
- Sends live metrics to iPhone
- Receives activity templates from iPhone
- Receives battery profiles from iPhone
- Sends alerts to iPhone

### 6. **Data Persistence** (~100 lines)
- Periodic autosave during runs
- Crash recovery data
- Route coordinates
- Heart rate samples
- Form monitor samples

### 7. **Preset/Activity Management** (~50 lines)
- Sets active workout preset
- Sets active activity template
- Configures feedback settings

### 8. **Battery Management Coordination** (~50 lines)
- Integrates with `BatteryManager`
- Adjusts sampling intervals based on battery profile
- Auto-saves based on battery settings

### 9. **Form Metrics Collection** (~50 lines)
- Collects form metrics
- Manages form session ID
- Syncs form samples to SwiftData

### 10. **Error Handling** (~50 lines)
- GPS errors
- HealthKit errors
- Workout errors
- User-facing error messages

## The Problem

**Single Responsibility Principle Violation**: This class does at least 10 different things!

**Why This Is Bad**:
- Hard to understand
- Hard to test
- Hard to maintain
- Hard to debug
- Changes in one area can break others
- Impossible to reuse components

## The Solution

I've created focused managers that each do ONE thing:

### ✅ `GPSManager` (NEW)
- **Only** handles GPS tracking
- Clean, focused API
- ~150 lines (vs 150 lines buried in LocationManager)

### ✅ `HealthKitManager` (NEW)
- **Only** handles HealthKit workouts
- Clean, focused API
- ~100 lines (vs 100 lines buried in LocationManager)

### ✅ `RunStateManager` (NEW)
- **Only** handles run lifecycle
- Start/pause/resume/stop
- Recovery management
- ~100 lines (vs 150 lines buried in LocationManager)

### ✅ `RunMetricsCalculator` (NEW)
- **Only** calculates metrics
- Static utility functions
- ~80 lines (vs 100 lines buried in LocationManager)

## Next Steps

The refactored `LocationManager` should:
1. **Coordinate** these managers (not do their work)
2. **Orchestrate** the run workflow
3. **Publish** combined state for UI
4. Be **~300 lines** instead of 945

## Migration Path

1. ✅ Created new managers (done)
2. ⏳ Refactor LocationManager to use managers
3. ⏳ Update RunView to use new structure
4. ⏳ Test thoroughly
5. ⏳ Remove old code

## Benefits

- **Readable**: Each file does one thing
- **Testable**: Can test GPS separately from HealthKit
- **Maintainable**: Changes isolated to one manager
- **Reusable**: GPSManager can be used elsewhere
- **Debuggable**: Clear separation of concerns








