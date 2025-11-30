# Hybrid Coach System: Rule-Based + Core ML

## Overview

The Form Coach uses a **hybrid system** that intelligently combines rule-based coaching with Core ML predictions, automatically switching when ready.

## How It Works

### Three Modes

1. **Auto Mode** (Default)
   - Uses **Core ML** if bootstrap model is available (included from start)
   - Falls back to **rule-based** if model not found
   - Model works immediately, no training data needed
   - Shows status: "Auto (Core ML - Learning)" or "Auto (Rule-Based)"

2. **Rule-Based Mode**
   - Always uses rule-based heuristics
   - Adaptive learning adjusts thresholds over time
   - Works immediately, no model needed

3. **Core ML Mode**
   - Always uses Core ML model (if available)
   - Falls back to rule-based if model not found
   - Requires trained `.mlmodel` file

## Automatic Switching Logic

### Auto Mode Behavior

```
Start → Check for bootstrap model
  ↓
Model available?
  ↓
Yes → Use Core ML (works immediately)
  ↓
No → Use Rule-Based (fallback)
  ↓
Both systems learn and adapt as you run
```

### Training Data Collection

- **Every run**: Metrics + recommendations are logged
- **Sample count**: Stored in UserDefaults (for future retraining)
- **Status**: Visible in Settings when in Auto mode
- **Export**: Available for training improved models
- **Note**: Model works immediately, data collection is for future improvements

## Settings Integration

### Coach Mode Picker

In Settings → Form Coach section:
- **Auto**: Automatic switching (recommended)
- **Rule-Based**: Force rule-based always
- **Core ML**: Force Core ML (if model available)

### Training Progress

When in Auto mode, shows:
- Current sample count
- Progress bar (0-100 samples)
- Status: "Auto (Rule-Based, X/100 samples)" or "Auto (Core ML)"

## How They Work Together

### Recommendation Flow

```
1. Check current mode
   ↓
2. If Core ML enabled:
   - Try Core ML prediction
   - If prediction succeeds → Use it
   - If fails/low confidence → Fallback
   ↓
3. If Rule-Based (or Core ML failed):
   - Use comprehensive rule-based analysis
   - Apply adaptive learning thresholds
   - Generate recommendation
```

### Fallback Strategy

- **Core ML fails** → Automatically falls back to rule-based
- **Model not available** → Uses rule-based
- **Low confidence** → Uses rule-based
- **No recommendation** → Rule-based provides backup

## Training Data

### What Gets Logged

Every 5 seconds during runs:
- Cadence
- Vertical Oscillation
- Ground Contact Time
- Stride Length
- Heart Rate
- Pace
- Distance
- Recommendation given

### Export for Training

```swift
let csv = formCoach.exportTrainingData()
// Use this CSV to train your Core ML model
```

## Adding a Core ML Model

### Step 1: Train Your Model

1. Export training data: `formCoach.exportTrainingData()`
2. Train model using Create ML or Python (coremltools)
3. Export as `.mlmodel`

### Step 2: Add to Xcode

1. Drag `FormCoachModel.mlmodel` into Xcode project
2. Xcode compiles it to `.mlmodelc`
3. Model is automatically detected

### Step 3: Model Input Schema

Your model should accept:
- `cadence`: Double
- `vertical_oscillation`: Double
- `ground_contact_time`: Double
- `stride_length`: Double
- `heart_rate`: Double
- `pace`: Double

### Step 4: Model Output Schema

Your model should output:
- `recommendation_type`: String (e.g., "increase_cadence", "run_flatter", etc.)
- `confidence`: Double (0.0-1.0)

## Benefits of Hybrid Approach

1. **Works Immediately**: Rule-based starts right away
2. **Learns Over Time**: Adaptive learning personalizes
3. **Improves Automatically**: Switches to ML when ready
4. **Always Reliable**: Fallback ensures recommendations
5. **User Control**: Manual override available

## Example Scenarios

### Scenario 1: New User (Model Included)
- **Mode**: Auto
- **Active**: Core ML
- **Status**: "Auto (Core ML - Learning)"
- **Behavior**: Uses bootstrap model immediately, adapts as you run

### Scenario 2: Model Not Included
- **Mode**: Auto
- **Active**: Rule-Based
- **Status**: "Auto (Rule-Based)"
- **Behavior**: Uses rule-based system, collects data for future model training

### Scenario 3: Manual Override
- **Mode**: Rule-Based (manual)
- **Active**: Rule-Based
- **Status**: "Rule-Based"
- **Behavior**: Always uses rules, ignores ML model

### Scenario 4: Manual Override
- **Mode**: Rule-Based (manual)
- **Active**: Rule-Based
- **Status**: "Rule-Based"
- **Behavior**: Always uses rules, ignores ML

## Technical Details

### Mode Storage
- Stored in UserDefaults: `FormCoachMode`
- Persists across app launches
- Default: `auto`

### Training Sample Count
- Stored in UserDefaults: `FormCoachTrainingSamples`
- Increments every evaluation (every 5 seconds)
- Resets when data cleared

### Core ML Model Loading
- Loaded at FormCoach initialization
- Checks for `FormCoachModel.mlmodelc` in bundle
- Cached for performance

## Best Practices

1. **Start with Auto**: Let it learn and switch automatically
2. **Collect Data**: Run normally, data is collected automatically
3. **Train Model**: Export data when you have 100+ samples
4. **Add Model**: Drop trained model into Xcode
5. **Monitor**: Check Settings to see progress

## Troubleshooting

### Core ML Not Working
- Check model is in bundle
- Verify model input/output schema matches
- Check console for loading errors
- Falls back to rule-based automatically

### Training Data Not Increasing
- Ensure you're running (not just viewing)
- Check FormCoach is evaluating (every 5s)
- Verify UserDefaults permissions

### Mode Not Switching
- Auto mode uses model if available (no sample requirement)
- Check Settings to see current status
- Manually switch if needed

