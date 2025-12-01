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

## Other Documentation

### `SIGNING_FIX_PLAN.md` (watchos/)
- **Purpose**: Xcode signing configuration guide
- **Content**: Signing setup instructions
- **Status**: ⚠️ May be outdated (check if still relevant)

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



