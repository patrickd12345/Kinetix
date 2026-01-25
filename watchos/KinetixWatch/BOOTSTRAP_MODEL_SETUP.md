# Bootstrap Model Setup

## Overview

The Form Coach includes a **bootstrap Core ML model from the start** that works immediately and improves through on-device adaptive learning as you run.

## How It Works

1. **Bootstrap Model**: Included in app bundle (trained on rule-based logic)
2. **Works Immediately**: No training data needed to start
3. **Adaptive Learning**: Adjusts thresholds/multipliers based on real outcomes
4. **Improves Over Time**: Gets better as it learns from your runs

## Generating the Bootstrap Model

### Step 1: Generate Training Data

Use the `BootstrapModelGenerator` to create training data:

```swift
let csv = BootstrapModelGenerator.generateTrainingData(count: 10000)
// Save to file for training
```

Or use this Python script:

```python
import pandas as pd
import numpy as np

# Generate synthetic training data from rules
data = []
for _ in range(10000):
    cadence = np.random.uniform(140, 200)
    vertical_osc = np.random.uniform(5, 15)
    gct = np.random.uniform(200, 350)
    stride = np.random.uniform(0.8, 1.5)
    hr = np.random.uniform(120, 180)
    pace = np.random.uniform(180, 600)
    
    # Apply rule-based logic
    if stride > 1.3 and cadence < 160:
        step_len = stride / 2.0
        if step_len > 0.7:
            recommendation = "overstriding"
            confidence = 0.9
        else:
            recommendation = "good_form"
            confidence = 0.7
    elif cadence < 160:
        recommendation = "increase_cadence"
        confidence = 0.85
    elif vertical_osc > 12.0:
        recommendation = "run_flatter"
        confidence = 0.8
    elif gct > 300:
        recommendation = "light_feet"
        confidence = 0.75
    else:
        recommendation = "good_form"
        confidence = 0.7
    
    data.append({
        'cadence': cadence,
        'vertical_oscillation': vertical_osc,
        'ground_contact_time': gct,
        'stride_length': stride,
        'heart_rate': hr,
        'pace': pace,
        'recommendation_type': recommendation,
        'confidence': confidence
    })

df = pd.DataFrame(data)
df.to_csv('bootstrap_training_data.csv', index=False)
```

### Step 2: Train Model

Using Create ML or Python:

**Option A: Create ML (Apple's Tool)**
1. Open Create ML app
2. Create new Classifier
3. Import `bootstrap_training_data.csv`
4. Set features: cadence, vertical_oscillation, ground_contact_time, stride_length, heart_rate, pace
5. Set target: recommendation_type
6. Train model
7. Export as `FormCoachModel.mlmodel`

**Option B: Python (scikit-learn + coremltools)**
```python
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import coremltools as ct

# Load data
df = pd.read_csv('bootstrap_training_data.csv')

# Prepare features and target
X = df[['cadence', 'vertical_oscillation', 'ground_contact_time', 
        'stride_length', 'heart_rate', 'pace']]
y = df['recommendation_type']

# Train model
model = RandomForestClassifier(n_estimators=100, max_depth=10)
model.fit(X, y)

# Convert to Core ML
coreml_model = ct.converters.sklearn.convert(
    model,
    input_features=[
        ct.models.datatypes.Double(name='cadence'),
        ct.models.datatypes.Double(name='vertical_oscillation'),
        ct.models.datatypes.Double(name='ground_contact_time'),
        ct.models.datatypes.Double(name='stride_length'),
        ct.models.datatypes.Double(name='heart_rate'),
        ct.models.datatypes.Double(name='pace'),
    ],
    output_features=[
        ct.models.datatypes.String(name='classLabel'),  # Predicted class
        ct.models.datatypes.Dictionary(keyType: .string, valueType: .double, name: 'classProbability')  # Class probabilities
    ]
)

# Add metadata
coreml_model.author = "Kinetix"
coreml_model.short_description = "Bootstrap form coach model"
coreml_model.version = "1.0"

# Save
coreml_model.save('FormCoachModel.mlmodel')
```

### Step 3: Add to Xcode

1. Drag `FormCoachModel.mlmodel` into your Xcode project
2. Xcode will compile it to `FormCoachModel.mlmodelc`
3. Ensure it's included in the app target
4. The model will be loaded automatically on app start

## On-Device Learning

The model doesn't retrain itself, but it **adapts** through:

### Adaptive Thresholds

The system adjusts multipliers that modify how the model interprets inputs:

- **cadenceMultiplier**: Adjusts sensitivity to cadence issues
- **oscillationMultiplier**: Adjusts sensitivity to vertical oscillation
- **gctMultiplier**: Adjusts sensitivity to ground contact time
- **strideMultiplier**: Adjusts sensitivity to stride length
- **confidenceThreshold**: Minimum confidence to use model output

### How Learning Works

1. **Model makes prediction** using bootstrap weights
2. **Recommendation shown** to user
3. **Outcome tracked**: Did form improve?
4. **Multipliers adjusted**:
   - If helped → Increase multiplier (more sensitive)
   - If didn't help → Decrease multiplier (less sensitive)
5. **Next prediction** uses adjusted multipliers

This simulates the model "learning" your personal running style.

## Model Input/Output

### Input Features
- `cadence`: Double (steps per minute)
- `vertical_oscillation`: Double (cm)
- `ground_contact_time`: Double (ms)
- `stride_length`: Double (meters)
- `heart_rate`: Double (bpm)
- `pace`: Double (seconds per km)

### Output
- `recommendation_type`: String
  - "increase_cadence"
  - "run_flatter"
  - "light_feet"
  - "overstriding"
  - "good_form"

## Testing

After adding the model:

1. Run the app
2. Check console for: `[CoreMLCoach] Bootstrap model loaded successfully`
3. Start a run
4. Model should provide recommendations immediately
5. Check Settings → Form Coach → should show "Auto (Core ML - Learning)"

## Future Improvements

- Collect real data during runs
- Retrain model periodically with real data
- Replace bootstrap model with improved version
- Model gets better over time with more real-world data

