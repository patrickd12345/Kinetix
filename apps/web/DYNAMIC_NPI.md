# Dynamic NPI System

## Overview

The NPI (Normalized Performance Index) is now calculated **dynamically** relative to your current Personal Best (PB). The PB run always has NPI = 100, and all other runs are scaled proportionally.

## How It Works

### 1. **Baseline Run (PB)**
- The run with the **highest absolute NPI** is automatically your baseline/PB
- This baseline run always displays as **NPI = 100**
- When you set a new PB, it automatically becomes the new baseline

### 2. **Relative NPI Calculation**
For any run, the relative NPI is calculated as:
```
relativeNPI = (runAbsoluteNPI / baselineAbsoluteNPI) × 100
```

### 3. **Automatic Updates**
- When you complete a new run, the system checks if it's a new PB
- If it is, that run becomes the new baseline (NPI = 100)
- All other runs automatically recalculate relative to the new baseline
- **No manual normalization needed!**

## Implementation

### Database Storage
- **Absolute NPI** is stored in the database (for historical accuracy)
- **Relative NPI** is calculated dynamically when displayed

### Components Updated
- ✅ **History Page**: Shows relative NPI for all runs
- ✅ **Run Dashboard**: Shows relative NPI during live runs
- ✅ **Run Store**: Stores absolute NPI, calculates relative in UI

### Key Files
- `apps/web/src/lib/npiUtils.ts` - Utility functions for baseline and relative NPI
- `apps/web/src/hooks/useBaselineNPI.ts` - Hook for baseline run management
- `packages/core/src/npi/calculator.ts` - Core NPI calculation logic

## Benefits

1. **Always Up-to-Date**: No need to re-run normalization scripts
2. **Automatic PB Detection**: New PBs automatically become baseline
3. **Consistent Scale**: PB always = 100, making comparisons intuitive
4. **Historical Accuracy**: Absolute NPIs preserved in database

## Example

If your September 30, 2025 run has absolute NPI = 135.0:
- That run displays as **NPI = 100** (it's your PB)
- A run with absolute NPI = 120.0 displays as **NPI = 88.89** (120/135 × 100)
- A run with absolute NPI = 90.0 displays as **NPI = 66.67** (90/135 × 100)

If you then run a new PB with absolute NPI = 140.0:
- That new run becomes **NPI = 100** (new baseline)
- Your September 30 run becomes **NPI = 96.43** (135/140 × 100)
- All runs automatically recalculate!

## Migration Notes

The normalization scripts (`normalize-npi.ts`, `normalize-npi-browser.html`) are no longer needed since NPI is calculated dynamically. They remain in the codebase for reference but are not required for normal operation.
