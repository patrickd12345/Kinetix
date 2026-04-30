# Kinetix iPhone App - Feature List

## ✅ Implemented Features

### Core Management Features
- ✅ **5-Tab Architecture**: Home, Coach, Build, History, Settings
- ✅ **Watch Connectivity**: Real-time communication with Watch app
- ✅ **Data Synchronization**: Bidirectional sync with Watch
- ✅ **Run History**: Complete list of all runs (Watch & iPhone recorded)
- ✅ **Run Detail Views**: Full post-run analysis

### Standalone Tracking (NEW)
- ✅ **Direct Run Tracking**: iPhone now supports standalone run tracking
- ✅ **GPS Integration**: High-precision GPS tracking with signal monitoring
- ✅ **HealthKit Integration**: Heart rate collection directly from iPhone/Watch
- ✅ **NPI Calculation**: Real-time KPS calculation on device
- ✅ **"Glass" Tracking UI**: High-performance UI optimized for iPhone 17 Pro Max

### Coach Tab (Dashboard)
- ✅ **Live Metrics Dashboard**: Real-time charts for heart rate and cadence
- ✅ **Deterministic Coaching**: Ported from Web (Timeline, Goal Probability)
- ✅ **Conversational AI Coach**: Ask questions about your run via voice
- ✅ **Live Biometric Stream**: Real-time data from Watch displayed on iPhone
- ✅ **Alert System**: Receives and vocalizes alerts from Watch
- ✅ **Voice Recognition**: Speech recognition for questions
- ✅ **Text-to-Speech**: Premium voices for natural-sounding coaching

### Omni-Intelligence & Agentic Core (NEW)
- ✅ **Garmin Integration**: Ingest Body Battery, Stress, and Sleep telemetry.
- ✅ **Productivity Correlation**: Correlate Cursor/GitHub "Deep Work" with physical stress spikes.
- ✅ **Proactive Adaptation**: Auto-generate recovery-aware recommendations (e.g. Body Battery < 40).
- ✅ **Reasoning Logs**: Full "Chain of Thought" transparency for AI coaching decisions.
- ✅ **Technical Insights**: View raw telemetry and reasoning chains in Settings.

### Apple Intelligence
- ✅ **Readiness Explanations**: Context-aware readiness analysis (iOS 18+).
- ✅ **On-Device Summaries**: Fast, private post-run summaries.
- ✅ **Proactive Insights**: Home screen intelligence cards.

### History Tab
- ✅ **Run History List**: Complete list of all runs
- ✅ **Optional song metadata on runs**: Model supports optional `songTitle`, `songArtist`, `songBpm` (synced with Watch payload and cloud JSON; DB `song_bpm` **40–240** when present); post-run AI may use BPM vs cadence when set
- ✅ **Detailed Run Views**: Full post-run analysis including:
  - Lab report with form score
  - Biomechanics grid
  - AI-generated summary
  - Route map
  - All metrics and statistics

### Settings Tab
- ✅ **Runner Profile**: Weight, date of birth, sex
- ✅ **Battery Profile Manager**: 
  - Create custom battery profiles
  - Configure GPS, motion sensor, and form analysis intervals
  - Toggle haptics, voice, and live charts
  - Profiles automatically sync to Watch
- ✅ **Activity Builder**: Create custom workout templates with:
  - Custom screens (Form Bubble, Metrics, Pace, NPI, Map, Coach, History)
  - Goal types (Efficiency, Race, Burner, Form Monitor, Free Run)
  - Feedback settings (haptics, speech, bubble sensitivity, sonic feedback)
  - Default battery profile assignment
- ✅ **Find My NPI**: Manual entry tool for race results or treadmill sessions
- ✅ **AI Training Summary**: Generate summaries of last 6 weeks of training
- ✅ **Training Distribution**: Visual chart showing Speed/Strength, Endurance, and Stability axes
- ✅ **Diagnostics**: Export logs, clear logs, troubleshoot sync issues

### Watch Connectivity
- ✅ **Real-time Data Streaming**: Receives live metrics from Watch
- ✅ **Bidirectional Sync**: 
  - Activities sync from iPhone to Watch
  - Battery profiles sync from iPhone to Watch
  - Run data syncs from Watch to iPhone
- ✅ **Background Updates**: Uses application context for reliable background sync
- ✅ **Alert System**: Receives alerts from Watch for vocalization

### Voice & Audio
- ✅ **iPhone-Based Audio**: All audio coaching comes from iPhone
- ✅ **Voice Alerts**: AI-generated voice coaching delivered through iPhone
- ✅ **Music Mixing**: Voice alerts mix seamlessly with background music
- ✅ **Speech Recognition**: Ask questions to AI coach via voice
- ✅ **Text-to-Speech**: Premium voices for natural-sounding coaching

### AI Integration
- ✅ **Coach AI (Apple-first)**: Platform gate targets iPhone + iOS 26+ for native/on-device path; conversational chat uses a neutral fallback until Apple Intelligence / Foundation Models coach chat is wired (`TODO`). Production UX does not mention Gemini or third-party keys.
- ✅ **Run Analysis**: AI-generated summaries and insights
- ✅ **Conversational Coach**: Interactive Q&A with AI coach (DEBUG-only optional Gemini for engineering when enabled)

### Data Management
- ✅ **SwiftData Persistence**: Local data storage
- ✅ **Run Storage**: All runs synced from Watch
- ✅ **Profile Management**: Runner profile and preferences

## ❌ Missing Features / Limitations

### Not Implemented
- ❌ **Form Metrics Collection**: Watch collects form data, iPhone displays it
- ❌ **Export/Share Runs**: Export to GPX/TCX or share to other apps
- ❌ **Social Features**: Sharing, leaderboards, etc.
- ❌ **Map Visualization**: Route map display (data available but visualization limited)

### Platform Limitations
- ⚠️ **Dependent on Watch**: Most features require Watch app to be running
- ⚠️ **No Standalone Running**: Cannot track runs without Watch
- ⚠️ **Watch Connectivity Required**: Many features need active Watch connection

### Future Enhancements
- 🔮 Export to Strava/other platforms
- 🔮 Social features (optional)
- 🔮 Advanced training plans
- 🔮 More detailed biomechanics analysis
- 🔮 Custom ML model training
- 🔮 Map visualization improvements

---

**Last Updated**: 2025-01-XX
**Platform**: iOS 17.0+
**Status**: Production Ready









