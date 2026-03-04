# Kinetix Architecture Overview

## Current Platforms

### 1. **Apple Watch App** (watchOS)
- **Location**: `watchos/KinetixWatch/`
- **Purpose**: Standalone run tracking, sensor data collection
- **Features**: GPS, HealthKit, form metrics, NPI calculation
- **AI**: Sends data to iPhone for AI analysis

### 2. **iPhone App** (iOS)
- **Location**: `ios/KinetixPhone/`
- **Purpose**: Management hub, AI coaching, settings
- **Features**: AI analysis (Gemini API), voice coaching, run history, settings
- **AI**: Uses Gemini API for AI coaching

### 3. **Web App / PWA** (Browser)
- **Location**: `web/`
- **Purpose**: Cross-platform access, quick tracking
- **Features**: GPS tracking, NPI calculation, run history
- **AI**: Uses local Ollama (falls back to rule-based if unavailable)
- **Installable**: Yes, as PWA (Progressive Web App)

## Important: Web App = PWA

**The web app and PWA are the SAME thing:**
- **Web App**: Runs in browser (can be accessed via URL)
- **PWA**: Installable version of the same web app
- **Same codebase**: One app, two ways to access it
- **AI Support**: Both use Ollama (local) with rule-based fallback

## AI Architecture by Platform

### Watch App
- ❌ No AI processing (limited resources)
- ✅ Sends data to iPhone for AI analysis

### iPhone App
- ✅ Uses **Gemini API** for AI coaching
- ✅ Voice coaching via iPhone
- ✅ Conversational AI coach

### Web App / PWA
- ✅ Uses **Ollama** (local LLM) for AI analysis
- ⚠️ Falls back to **rule-based analysis** if Ollama unavailable
- ✅ All processing happens locally (privacy-focused)
- ✅ No API keys needed (when using Ollama)

## Deployment Options

### Watch & iPhone Apps
- **Distribution**: App Store (when ready)
- **Installation**: Standard iOS/watchOS app installation
- **Updates**: Through App Store

### Web App / PWA
- **Distribution**: 
  - Deployed to Vercel/Netlify (accessible via URL)
  - Installable as PWA (add to home screen)
- **Installation**: 
  - Browser-based (just visit URL)
  - PWA install (one-click install prompt)
- **Updates**: Automatic (when user visits)

## Feature Comparison

| Feature | Watch | iPhone | Web/PWA |
|---------|-------|--------|---------|
| **Run Tracking** | ✅ | ❌ | ✅ |
| **GPS** | ✅ | ❌ | ✅ |
| **NPI** | ✅ | ⚠️ (displays) | ✅ |
| **Form Metrics** | ✅ | ⚠️ (displays) | ❌ |
| **AI Analysis** | ❌ | ✅ (Gemini) | ✅ (Ollama) |
| **Voice Coaching** | ❌ | ✅ | ❌ |
| **Settings** | ⚠️ (limited) | ✅ | ✅ |
| **History** | ✅ | ✅ | ✅ |
| **Installable** | ✅ (App Store) | ✅ (App Store) | ✅ (PWA) |

## AI Agent Status

### Watch App
- **No AI agent** (by design - sends to iPhone)

### iPhone App
- **AI agent**: Gemini API (cloud-based)
- **Always available** (requires internet)

### Web App / PWA
- **AI agent**: Ollama (local) OR rule-based fallback
- **With Ollama**: Full AI analysis
- **Without Ollama**: Rule-based analysis (still works!)

## KPS (Kinetix Performance Score) - Non-Negotiable Invariants

**1. KPS is ALWAYS age-weight graded.** This is the essence of KPS and is non-negotiable for all future development.

- Every KPS display, comparison, chart, or ranking MUST use `calculateAbsoluteKPS(run, profile)` with a profile that includes age and weight.
- Use `getProfileForRun(run)` or `getProfileForRunDate(run.date)` to obtain the correct profile (weight at run date).
- Stored `run.kps` is a cache only; it MUST NOT be used for display or comparison.

**2. The all-time PB has KPS = 100. Any other run's KPS is a ratio of that one.**

- The PB run ALWAYS displays KPS = 100, by definition.
- Other runs: displayed KPS = (run_absolute / pb_absolute) * 100.
- Use `calculateRelativeKPS` / `calculateRelativeKPSSync` for display; never raw absolute KPS for user-facing KPS.

See `KPS_CONTRACT.md`, `apps/web/src/lib/kpsUtils.ts`, and `packages/core/src/kps/calculator.ts` for the full invariant documentation.

## Summary

You have **3 platforms**:

1. **Watch App** - Native watchOS app
2. **iPhone App** - Native iOS app  
3. **Web App / PWA** - Browser-based app (same code, installable)

**The web app is NOT separate from the PWA** - they're the same app:
- Access via browser = Web App
- Install as app = PWA
- Both have AI (Ollama) with fallback to rule-based

**There is no "webapp without AI agent"** - the webapp always has analysis:
- **Preferred**: Ollama (local AI)
- **Fallback**: Rule-based (always works)

---

**Last Updated**: 2025-01-XX









