# Kinetix - Intelligent Running Coach

A revolutionary running app for Apple Watch with iPhone companion, focusing on biomechanics, form efficiency, and personalized coaching through AI and real-time analysis.

## 🚀 Core Features

### 🧠 Intelligent Coaching System

- **Hybrid AI Engine**: Combines rule-based biomechanics with Core ML for adaptive, personalized feedback
- **Real-time Form Analysis**: Monitors vertical oscillation, cadence, ground contact time, and stride length
- **Adaptive Learning**: Learns your personal running baseline (e.g., adjusting for asymmetry) to provide personalized recommendations
- **Three Coach Modes**:
  - **Auto Mode**: Machine learning adapts to your running style
  - **Rule-Based**: Traditional biomechanics rules
  - **Core ML**: Advanced on-device machine learning
- **Voice Coaching**: AI-powered voice alerts delivered through iPhone (earphones paired to iPhone)
- **Form Recommendations**: Real-time haptic and voice feedback for form corrections

### 🏃‍♂️ Running Metrics & Analytics

- **Kinetix Performance Score (KPS)**: Custom metric tracking running efficiency (internally: Normalized Performance Index)
  - Converts directly into predicted finish times for **any** race distance (from a mile to an ultramarathon)
  - Generates infinite "beat yourself" scenarios by recalculating projected finish times every few seconds based on live Kinetix Performance Score
  - Translates the score into target paces/splits so you always know how fast you need to run to stay on goal
  - Contract and invariants: see `KPS_CONTRACT.md` (non-negotiable behavior for age/weight grading and PB-relative display)
- **Comprehensive Biomechanics Tracking**:
  - Cadence (Steps per minute)
  - Vertical Oscillation (Bounce)
  - Ground Contact Time
  - Stride Length
  - Form Score (0-100)
  - Left/Right Balance
- **Post-Run Lab Report**: Detailed breakdown including:
  - Form score visualization
  - Biomechanics grid with all metrics
  - AI-generated coach's analysis
  - Performance insights
- **Real-time Metrics**: Live tracking of pace, distance, heart rate, and form metrics
- **Route Tracking**: GPS-based route recording with map visualization

### ⌚ Watch App Features

- **Standalone Operation**: Runs entirely on Apple Watch (watchOS 10+)
- **Preset System**: Built-in workout presets:
  - **Kinetix**: KPS tracking with progress gauge
  - **Race Mode**: Target finish time pacing
  - **Burner**: Fat-burn biomechanics focus
  - **Form Monitor**: Real-time form analysis
  - **Custom**: User-created activity templates
- **Preset Selection Screen**: Startup screen to choose workout type before run
- **Battery Profiles**: 
  - **Built-in Profiles**: Aggressive, Balanced, Eco, Emergency
  - **Custom Profiles**: Create and sync custom battery profiles from iPhone
  - **Auto-Switch**: Automatically switches to more conservative profiles at battery thresholds (40%, 20%, 10%)
- **Background Tracking**: Reliable workout recording even when screen is off
- **Haptic Feedback**: Subtle taps for form corrections
- **Always-On Display**: Optimized for quick glances
- **Pause/Resume**: Full pause/resume functionality during runs
- **Crash Recovery**: Automatic recovery of interrupted runs with resume option
- **GPS Status Monitoring**: Real-time GPS accuracy tracking with visual indicators
- **Data Persistence**: Periodic autosave during runs (frequency based on battery profile)

### 📱 iPhone Companion App

The iPhone app serves as a **Management & Analysis Hub** with a 3-tab architecture:

#### 1. **Coach Tab** (Dashboard)
- **Live Metrics Dashboard**: Real-time charts for heart rate and cadence
- **Conversational AI Coach**: Ask questions about your run via voice
- **Live Biometric Stream**: Real-time data from Watch displayed on iPhone
- **Alert System**: Receives and vocalizes alerts from Watch

#### 2. **History Tab**
- **Run History**: Complete list of all runs synced from Watch
- **Detailed Run Views**: Full post-run analysis including:
  - Lab report with form score
  - Biomechanics grid
  - AI-generated summary
  - Route map
  - All metrics and statistics

#### 3. **Settings Tab**
- **Runner Profile**: Weight, date of birth, sex (for AI summaries and training distribution)
- **Battery Profile Manager**: 
  - Create custom battery profiles
  - Configure GPS, motion sensor, and form analysis intervals
  - Toggle haptics, voice, and live charts
  - Profiles automatically sync to Watch
- **Activity Builder**: Create custom workout templates with:
  - Custom screens (Form Bubble, Metrics, Pace, Kinetix Performance Score, Map, Coach, History)
  - Goal types (Efficiency, Race, Burner, Form Monitor, Free Run)
  - Feedback settings (haptics, speech, bubble sensitivity, sonic feedback)
  - Default battery profile assignment
- **Find My Score**: Manual entry tool for race results or treadmill sessions
- **AI Training Summary**: Generate summaries of last 6 weeks of training
- **Training Distribution**: Visual chart showing Speed/Strength, Endurance, and Stability axes
- **Diagnostics**: Export logs, clear logs, troubleshoot sync issues

### 🔋 Battery Management

- **Dynamic Battery Profiles**: 
  - **Aggressive**: Max precision (1s GPS, full features)
  - **Balanced**: Standard (2s GPS, optimized)
  - **Eco**: Long run (5s GPS, haptics only)
  - **Emergency**: Survival (10s GPS, minimal features)
- **Custom Profiles**: Create unlimited custom profiles with fine-tuned settings
- **Auto-Switch Thresholds**: Configurable auto-switching at 40%, 20%, or 10% battery
- **Battery-Safe Persistence**: More frequent saves in low-battery modes
- **Adaptive Sampling**: GPS, motion sensor, and form analysis intervals adjust based on battery level

### 🎯 Workout Presets & Activity Templates

- **Built-in Presets**: Pre-configured for common workout types
- **Custom Activity Templates**: Create unlimited custom activities on iPhone
- **Template Configuration**:
  - Primary and secondary screens
  - Goal type (Efficiency, Race, Burner, Form Monitor, Free Run)
  - Feedback settings (haptics, speech, sonic)
  - Default battery profile
  - Custom icons
- **Automatic Sync**: Templates sync from iPhone to Watch via Watch Connectivity

### 🔄 Watch Connectivity

- **Real-time Data Streaming**: Watch streams live metrics to iPhone
- **Bidirectional Sync**: 
  - Activities sync from iPhone to Watch
  - Battery profiles sync from iPhone to Watch
  - Run data syncs from Watch to iPhone
- **Background Updates**: Uses application context for reliable background sync
- **Alert System**: Watch sends alerts to iPhone for vocalization

### 🎤 Voice & Audio

- **iPhone-Based Audio**: All audio coaching comes from iPhone (earphones paired to iPhone)
- **Voice Alerts**: AI-generated voice coaching delivered through iPhone
- **Music Mixing**: Voice alerts mix seamlessly with background music
- **Speech Recognition**: Ask questions to AI coach via voice on iPhone
- **Text-to-Speech**: Premium voices for natural-sounding coaching

### 📊 Post-Run Analysis

- **Lab Report**: Comprehensive post-run analysis including:
  - Form score (0-100)
  - Biomechanics grid (cadence, bounce, GCT, stride)
  - AI-generated coach's analysis
  - Performance insights
- **Run Detail View**: Full breakdown of every run with:
  - Route map
  - All metrics
  - Form metrics
  - Coach's analysis
  - Historical comparison

### 🛡️ Reliability Features

- **Crash Recovery**: Automatic detection and recovery of interrupted runs
- **Data Persistence**: Periodic autosave during runs
- **GPS Status Monitoring**: Real-time GPS accuracy tracking
- **Error Handling**: User-friendly error messages for GPS, HealthKit, and workout errors
- **Run Validation**: Prevents saving invalid runs (< 100m or < 10s)
- **HealthKit Integration**: Deep integration with HealthKit for heart rate and workout data
- **Background Operation**: Reliable tracking even when app is backgrounded

## 🛠 Technical Stack

- **SwiftUI & SwiftData**: Modern UI and persistence
- **Core ML**: On-device machine learning for form classification
- **HealthKit**: Deep integration for heart rate and workout data
- **Watch Connectivity**: Real-time data streaming between Watch and iPhone
- **Core Location**: GPS tracking and route recording
- **AVFoundation**: Audio session management, speech recognition, and text-to-speech
- **Gemini API**: AI-powered coaching and conversational responses
- **XcodeGen**: Programmatic project generation and management

## 📦 Installation

### Requirements
- Xcode 15+
- Apple Watch (watchOS 10.0+)
- iPhone (iOS 17.0+)
- Apple Developer account

### Setup
1. Clone the repository
2. Navigate to `watchos/` directory
3. Run `xcodegen generate` to generate the Xcode project
4. Open `KinetixWatch.xcodeproj` in Xcode
5. Select your Team in **Signing & Capabilities** for both targets:
   - `KinetixWatch` (Watch app)
   - `KinetixPhone` (iPhone app)
6. Build & Run on both devices

### ⚠️ Critical Setup for Connectivity
For the Watch and iPhone apps to communicate properly (WCSession), strict Bundle ID rules apply:
1. **Bundle ID Hierarchy**: The Watch App Bundle ID **MUST** be a child of the iPhone App Bundle ID.
   - iPhone: `com.yourcompany.appname`
   - Watch: `com.yourcompany.appname.watchkitapp`
2. **Info.plist Linkage**: The Watch App `Info.plist` **MUST** contain `WKCompanionAppBundleIdentifier` pointing to the iPhone App Bundle ID.
3. **Embedding**: The iPhone App target **MUST** embed the Watch App target (handled by `xcodegen` via `dependencies: embed: true`).

If you see "Watch App Not Installed" in the iPhone app diagnostics, one of these 3 rules is broken.

### Watch Installation Troubleshooting

**Having issues installing the Watch app?** See the comprehensive fix guide:

- **[Quick Fix](watchos/QUICK_FIX.md)** - Start here for the most common solution
- **[Complete Fix Guide](watchos/WATCH_INSTALL_FIX.md)** - Comprehensive solutions for all installation issues
- **[Automated Fix Script](watchos/fix-watch-install.sh)** - Run `./fix-watch-install.sh` for automated diagnostics

**Most Common Solution:** Install Watch app via iPhone first:
1. Build iPhone app in Xcode (KinetixPhone scheme)
2. On iPhone: Open Watch app → Find "Kinetix" → Tap "Install"
3. Wait 1-2 minutes for installation
4. Then build Watch app in Xcode (KinetixWatch scheme)

### Project Structure
```
Kinetix/
├── apps/web/                 # Canonical web app (Vite + React). Use this for all web work.
│   └── GARMIN_IMPORT.md      # Garmin ZIP / .fit import: in-app or pnpm garmin:import
├── apps/rag/                 # RAG backend service consumed by apps/web
├── docs/deployment/          # README index, INFISICAL_LOCAL_DEV, ENV_PARITY, STRIPE_KINETIX_ENTITLEMENTS, SSO / Vercel
├── archive/web-legacy/       # Archived legacy PWA reference
├── watchos/
│   ├── KinetixWatch/          # Watch app source
│   │   ├── Models/           # Data models
│   │   ├── Services/         # BatteryManager, etc.
│   │   └── ...
│   └── project.yml           # XcodeGen configuration
├── ios/
│   └── KinetixPhone/         # iPhone app source
└── README.md
```

## 🧪 Testing

- **Self-Test Suite**: Integrated directly into the app (Settings > Self-Test) to verify core logic on-device
- **UI Audit**: Custom internal tool to ensure accessibility and design consistency
- **Diagnostic Logs**: Export diagnostic logs for troubleshooting

## 🎨 Design Philosophy

- **"Anti-Social" Design**: Zero distractions. No feeds, no likes, just pure performance data
- **Voice-First Coaching**: Audio coaching delivered through iPhone for hands-free operation
- **Watch as Sensor Hub**: Watch focuses on data collection; iPhone handles AI and management
- **Modular Architecture**: Clean separation between Watch (sensors) and iPhone (intelligence)

## 📋 Feature Documentation

For detailed feature lists and comparisons across platforms:

- **[Watch App Features](FEATURES_WATCH.md)** - Complete list of watchOS features
- **[iPhone App Features](FEATURES_PHONE.md)** - Complete list of iOS features
- **[Web App Features](FEATURES_WEB.md)** - Complete list of web app features
- **[Feature Comparison](FEATURES_COMPARISON.md)** - Cross-platform feature comparison

## Platform spine compliance

Kinetix follows the shared **platform** layer for identity and access: **`platform.profiles`** and **`platform.entitlements`** (`product_key = 'kinetix'`). Stripe secrets are not embedded in the web client; future paid tiers extend Bookiji's canonical Stripe webhooks into entitlements.

| Resource | Location |
| -------- | -------- |
| Short contract | **[`SPINE_CONTRACT.md`](../../SPINE_CONTRACT.md)** (umbrella root) |
| Full integration guide (identity, payment, Infisical, new-app checklist) | **[`docs/platform/APP_INTEGRATION_STANDARD.md`](../../docs/platform/APP_INTEGRATION_STANDARD.md)** |
| Kinetix deployment index (SSO, Infisical, Stripe design) | **[`docs/deployment/README.md`](docs/deployment/README.md)** |

**Local verification:** from `products/Kinetix`, run `pnpm verify:infisical` (validates merged `/platform` + `/kinetix` and required Supabase client vars). There is no workspace-root `pnpm spine:audit`; rely on product tests and env checks per app.

## 📝 License

Proprietary / Personal Use.

## 🔮 Future Enhancements

- Advanced training plans
- Social features (optional)
- Export to Strava/other platforms
- More detailed biomechanics analysis
- Custom ML model training

---

**Built with ❤️ for runners who want to improve their form and performance.**
