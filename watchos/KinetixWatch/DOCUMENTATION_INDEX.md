# Documentation Index

This document provides an overview of all documentation files in the Kinetix Watch app.

## Core Documentation

### `README.md` (Project Root)
- **Purpose**: Main project documentation
- **Content**: Overview, features, setup instructions, usage guide
- **Status**: ✅ Up to date

## Form Coach Documentation

### `BOOTSTRAP_MODEL_SETUP.md`
- **Purpose**: How to create and integrate the bootstrap Core ML model
- **Content**: Step-by-step guide for generating training data, training model, adding to Xcode
- **Status**: ✅ Current (bootstrap model approach)
- **When to read**: When setting up the Core ML model for the first time

### `FORM_MODEL_GUIDE.md`
- **Purpose**: General guide to Core ML model creation and integration
- **Content**: Overview of Core ML, different training approaches, integration steps
- **Status**: ✅ Updated (references bootstrap approach)
- **When to read**: For understanding Core ML concepts and alternative training methods

### `HYBRID_COACH_SYSTEM.md`
- **Purpose**: Explains how rule-based and Core ML coaches work together
- **Content**: Three modes (Auto, Rule-Based, Core ML), switching logic, settings
- **Status**: ✅ Updated (reflects bootstrap model approach)
- **When to read**: For understanding the hybrid system architecture

### `ADAPTIVE_LEARNING.md`
- **Purpose**: Explains the adaptive learning system
- **Content**: How thresholds adjust, personalization, learning process
- **Status**: ✅ Current
- **When to read**: For understanding how the system learns from your runs

### `RUNNING_FORM_THEORY.md`
- **Purpose**: Explains the running form metrics and analysis
- **Content**: Core metrics, derived metrics, scientific basis, best practices
- **Status**: ✅ Current
- **When to read**: For understanding the biomechanics behind form coaching

## Watch App Feature Status & Guides

### `FEATURES_IMPLEMENTED.md`
- **Purpose**: Summarizes recently delivered critical features and UX flows
- **Content**: Pause/resume, crash recovery, GPS/HealthKit handling, alerts, validation
- **Status**: ✅ Current
- **When to read**: To understand which issues have been addressed and where the code lives

### `MISSING_FEATURES.md`
- **Purpose**: Tracks non-critical enhancement ideas
- **Content**: Auto-pause, richer recovery UI, exports, onboarding, battery tips
- **Status**: ✅ Current (backlog only)
- **When to read**: For prioritizing future work

### `TESTING.md`
- **Purpose**: How to run the in-app self-test suite and UI audit
- **Content**: Steps to execute diagnostics and recent compilation fixes
- **Status**: ✅ Current
- **When to read**: Before shipping builds or debugging regressions

### `LOCATION_MANAGER_GUIDE.md`
- **Purpose**: Explains the GPS/HealthKit pipeline and state machine
- **Content**: Authorization flow, workout lifecycle, data publishing, error handling
- **Status**: ✅ Current
- **When to read**: When modifying tracking logic or adding new metrics

### `UI_AUDIT_GUIDE.md` / `UI_AUDIT_SUMMARY.md`
- **Purpose**: Accessibility/design audit how-to and findings
- **Content**: Audit steps, criteria, and summarized outcomes
- **Status**: ✅ Current
- **When to read**: When running accessibility checks or updating UI components

### `AUDIT_REPORT.md`
- **Purpose**: Latest code/documentation audit results
- **Content**: Integrity findings, documentation alignment, remaining opportunities
- **Status**: ✅ Current
- **When to read**: For a snapshot of overall health and loose ends

## Other Documentation

### `SIGNING_FIX_PLAN.md` (watchos/)
- **Purpose**: Xcode signing configuration guide
- **Content**: Signing setup instructions
- **Status**: ⚠️ May be outdated (check if still relevant)

## iPhone Companion Documentation (ios/KinetixPhone)

### `FIT_SDK_INTEGRATION.md` / `QUICK_START_FIT.md`
- **Purpose**: Guidance for integrating the Garmin FIT SDK
- **Content**: Setup steps, scripts, and quick-start instructions
- **Status**: ⚠️ Review before use (integration may require updates)
- **When to read**: When working on run export/import for the iPhone app

### `INTEGRATE_NOW.md`
- **Purpose**: Checklist for enabling the iOS app experience
- **Content**: Configuration reminders and quick setup tips
- **Status**: ✅ Current
- **When to read**: After cloning to get the iPhone companion running

## Documentation Relationships

```
README.md (Project Overview)
  ↓
Form Coach System:
  ├── BOOTSTRAP_MODEL_SETUP.md (Primary: How to add model)
  ├── FORM_MODEL_GUIDE.md (General: Core ML concepts)
  ├── HYBRID_COACH_SYSTEM.md (Architecture: How it works)
  ├── ADAPTIVE_LEARNING.md (Learning: How it improves)
  └── RUNNING_FORM_THEORY.md (Science: What it analyzes)
```

## Quick Reference

- **Setting up Core ML model**: Read `BOOTSTRAP_MODEL_SETUP.md`
- **Understanding the system**: Read `HYBRID_COACH_SYSTEM.md`
- **Learning how it adapts**: Read `ADAPTIVE_LEARNING.md`
- **Understanding form metrics**: Read `RUNNING_FORM_THEORY.md`
- **General Core ML info**: Read `FORM_MODEL_GUIDE.md`

## Notes

- All documentation is in Markdown format
- Documentation is kept in `watchos/KinetixWatch/` directory
- Main README is in project root
- Documentation is updated as features evolve







