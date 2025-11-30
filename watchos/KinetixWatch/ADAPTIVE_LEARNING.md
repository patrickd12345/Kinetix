# Adaptive Learning System

## Overview

The Form Coach now includes an **adaptive learning system** that learns from your running patterns and improves its recommendations over time. It starts with sensible defaults and adjusts thresholds based on what works for **you**.

## How It Works

### 1. **Initial State (Default Thresholds)**
- Cadence threshold: 160 spm
- Vertical Oscillation: 12 cm
- Ground Contact Time: 300 ms
- Stride Length: 1.3 m

### 2. **Learning Process**

Every 5 seconds during a run:
1. **Evaluates your form** using current thresholds
2. **Shows recommendations** if needed
3. **Tracks outcomes**: Did your form improve after the recommendation?
4. **Adjusts thresholds** based on what works

### 3. **Adaptive Adjustments**

The system learns by observing:

- **Success Rate**: If recommendations consistently help you improve → thresholds are good
- **Low Success Rate**: If recommendations don't help → thresholds might be too strict for your style
- **Good Form Periods**: Learns your optimal ranges from times when you're running well

### 4. **Personalization**

After several runs, the system learns:
- **Your natural cadence range** (some runners naturally run at 155 spm, others at 180 spm)
- **Your optimal form metrics** (what "good form" looks like for you)
- **What recommendations actually help you** (not everyone responds the same way)

## Example Learning Scenarios

### Scenario 1: Natural Low Cadence Runner
- **Initial**: System warns when cadence < 160
- **Observation**: You consistently get "Increase Cadence" but it doesn't help
- **Learning**: System lowers threshold to 155 (recognizes your natural style)
- **Result**: Fewer false warnings, more relevant feedback

### Scenario 2: High Vertical Oscillation
- **Initial**: System warns when oscillation > 12 cm
- **Observation**: You naturally run with 13-14 cm oscillation and it's fine for you
- **Learning**: System adjusts threshold to 14 cm
- **Result**: Only warns when it's actually problematic

### Scenario 3: Effective Recommendations
- **Observation**: "Light Feet" recommendations consistently help you improve
- **Learning**: System becomes more proactive about this (lowers threshold slightly)
- **Result**: You get helpful feedback earlier

## Data Storage

- **Learned parameters** are stored in UserDefaults
- **Persists across app restarts**
- **Private and on-device** (no cloud sync)

## Learning Statistics

You can check learning progress:
```swift
let stats = formCoach.getLearningStats()
// Returns: (sampleCount, lastUpdated, successRate)
```

## Resetting Learning

If you want to start fresh:
```swift
formCoach.resetLearning()
```

This resets all learned thresholds to defaults.

## Technical Details

### Learning Frequency
- Evaluates outcomes every 5 seconds
- Learns/adjusts every 5 outcome samples
- Uses most recent 20 outcomes for learning (sliding window)

### Safety
- Thresholds have min/max bounds to prevent extreme values
- Conservative adjustments (small increments)
- Requires minimum samples before adjusting (prevents overfitting to noise)

### Implicit Feedback
The system uses **implicit feedback** - it doesn't ask you to rate recommendations. Instead, it observes:
- Did metrics improve after showing a recommendation?
- What metrics look like during "good form" periods?

## Future Enhancements

Potential improvements:
- Explicit feedback (thumbs up/down on recommendations)
- Learning from run outcomes (did you hit your NPI target?)
- Personalized optimal ranges per user profile
- Export learning data for analysis

## Privacy

- All learning happens **on-device**
- No data sent to servers
- All stored locally in UserDefaults
- You can reset at any time

