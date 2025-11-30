# Kinetix Watch App

A standalone, intelligent running coach for Apple Watch that focuses on biomechanics and form efficiency.

## 🚀 Features

### 🧠 Intelligent Coaching
- **Real-time Form Analysis**: Monitors vertical oscillation, cadence, and ground contact time.
- **Hybrid AI Engine**: Combines rule-based biomechanics with Core ML for adaptive feedback.
- **Adaptive Learning**: Learns your personal running baseline (e.g., adjusting for asymmetry) to provide personalized recommendations.
- **"Anti-Social" Design**: Zero distractions. No feeds, no likes, just pure performance data.

### 🏃‍♂️ Running Metrics
- **NPI (Normalized Performance Index)**: A custom metric tracking your running efficiency.
- **Biomechanics Tracking**:
  - Cadence (Steps per minute)
  - Vertical Oscillation (Bounce)
  - Ground Contact Time
  - Stride Length
- **Post-Run Lab Report**: detailed breakdown of your form efficiency and coach's analysis.

### ⌚ Watch Experience
- **Standalone App**: Runs entirely on Apple Watch (watchOS 10+).
- **Background Tracking**: Reliable workout recording even when the screen is off.
- **Haptic Feedback**: Subtle taps for form corrections (e.g., "Run Flatter", "Increase Cadence").
- **Always-On Display**: Optimized for quick glances.

## 🛠 Technical Stack
- **SwiftUI & SwiftData**: Modern UI and persistence.
- **Core ML**: On-device machine learning for form classification.
- **HealthKit**: Deep integration for heart rate and workout data.
- **TestFlight / Xcode**: Standard Apple deployment workflow.

## 📦 Installation

1. **Requirements**:
   - Xcode 15+
   - Apple Watch (watchOS 10.0+)
   - iPhone (iOS 17.0+)

2. **Setup**:
   - Clone the repository.
   - Open `KinetixWatch.xcodeproj`.
   - Select your Team in **Signing & Capabilities**.
   - Build & Run on your Apple Watch.

## 🧪 Testing
- **Self-Test Suite**: Integrated directly into the app (Settings > Self-Test) to verify core logic on-device.
- **UI Audit**: Custom internal tool to ensure accessibility and design consistency.

## 📝 License
Proprietary / Personal Use.
