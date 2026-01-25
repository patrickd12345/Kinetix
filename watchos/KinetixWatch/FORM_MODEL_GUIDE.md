# Core ML Model Guide for Form Coach

> **Note**: For the bootstrap model setup (model included from start), see `BOOTSTRAP_MODEL_SETUP.md`. This guide covers general Core ML model creation and integration.

## What is a Core ML Model?

A **Core ML model** (`.mlmodel` file) is a machine learning model that runs **on-device** (on your Apple Watch). It's a trained function that takes your running form metrics as input and outputs recommendations.

Think of it like this:
- **Rule-based approach**: Hard-coded rules (if cadence < 160, warn user)
- **ML approach**: A model that learned patterns from data (trained on thousands of runs)
- **Bootstrap approach**: Model trained on rule-based logic, included from start, improves through adaptive learning

## Why Use ML Instead of Rules?

1. **Learns complex patterns**: ML can find relationships you might not think of (e.g., "when HR is high AND cadence is low AND stride is long, that's overstriding")
2. **Personalizes**: Can adapt to individual running styles
3. **Improves over time**: Retrain with new data to get better

## How to Create a Core ML Model

### Option 1: Bootstrap from Your Current Heuristic (Recommended First Step)

Since you already have rule-based logic, you can:

1. **Generate synthetic training data** from your rules:
   ```python
   # Python example (using Create ML or scikit-learn)
   import pandas as pd
   import numpy as np
   
   # Simulate runs with various form metrics
   data = []
   for _ in range(10000):
       cadence = np.random.uniform(140, 200)
       vertical_osc = np.random.uniform(5, 15)
       gct = np.random.uniform(200, 350)
       stride = np.random.uniform(0.8, 1.5)
       hr = np.random.uniform(120, 180)
       
       # Apply your current rules to generate labels
       if cadence < 160:
           recommendation = "increase_cadence"
       elif vertical_osc > 12:
           recommendation = "run_flatter"
       elif gct > 300:
           recommendation = "light_feet"
       elif stride > 1.3 and cadence < 160:
           recommendation = "overstriding"
       else:
           recommendation = "good_form"
       
       data.append({
           'cadence': cadence,
           'vertical_oscillation': vertical_osc,
           'ground_contact_time': gct,
           'stride_length': stride,
           'heart_rate': hr,
           'recommendation': recommendation
       })
   
   df = pd.DataFrame(data)
   ```

2. **Train a model** to mimic your heuristic:
   ```python
   from sklearn.ensemble import RandomForestClassifier
   from coremltools import convert
   
   # Train model
   X = df[['cadence', 'vertical_oscillation', 'ground_contact_time', 
           'stride_length', 'heart_rate']]
   y = df['recommendation']
   
   model = RandomForestClassifier()
   model.fit(X, y)
   
   # Convert to Core ML
   import coremltools as ct
   coreml_model = ct.converters.sklearn.convert(
       model,
       input_features=[
           ct.models.datatypes.Double(name='cadence'),
           ct.models.datatypes.Double(name='vertical_oscillation'),
           ct.models.datatypes.Double(name='ground_contact_time'),
           ct.models.datatypes.Double(name='stride_length'),
           ct.models.datatypes.Double(name='heart_rate'),
       ],
       output_features=[ct.models.datatypes.String(name='recommendation')]
   )
   
   # Save
   coreml_model.save('FormCoach.mlmodel')
   ```

3. **Drop the `.mlmodel` file** into your Xcode project

### Option 2: Train on Real Data (Future)

Once you collect real running data:

1. **Log form metrics during runs** (add debug logging to FormCoach)
2. **Manually label** what the correct recommendation should have been
3. **Train a new model** on this real data
4. **Replace the old model** - just swap the `.mlmodel` file

### Option 3: Use Create ML (Apple's Tool)

1. Open **Create ML** app (comes with Xcode)
2. Create a new **Classifier** or **Regressor**
3. Import your training data (CSV with metrics + labels)
4. Train the model
5. Export as `.mlmodel`

## Integration Steps

Once you have a `.mlmodel` file:

1. **Add to Xcode project**: Drag `FormCoachModel.mlmodel` into your project
2. **Xcode compiles it**: Automatically creates `FormCoachModel.mlmodelc`
3. **Model is loaded automatically**: `CoreMLCoach` handles loading
4. **Output format**: The model should output one of:
   - **Class probabilities**: Dictionary with class names and probabilities (e.g., `{"increase_cadence": 0.85, "good_form": 0.15}`)
   - **Class label**: Single string with predicted class (e.g., `"increase_cadence"`)
   - **Custom schema**: `recommendation_type` (string) and `confidence` (double)

**Note**: The `CoreMLCoach` class handles all model integration. It supports multiple output formats automatically.

## Quick Start: Bootstrap Approach

The fastest way to get started:

1. **Keep your current heuristic** (it works!)
2. **Add data logging** to capture metrics during runs
3. **Generate synthetic data** from your rules
4. **Train a simple model** that mimics your rules
5. **Test it** - should give same results as rules
6. **Gradually improve** by retraining on real labeled data

## Resources

- [Apple Core ML Documentation](https://developer.apple.com/documentation/coreml)
- [Create ML Tutorial](https://developer.apple.com/machine-learning/create-ml/)
- [coremltools Python Package](https://coremltools.readme.io/)

