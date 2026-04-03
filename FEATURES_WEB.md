# Kinetix Web App - Feature List

## ✅ Implemented Features

### Core Running Features
- ✅ **GPS Tracking**: Browser Geolocation API for real-time location tracking
- ✅ **Run Recording**: Start, pause, resume, and stop runs
- ✅ **Route Recording**: GPS-based route tracking with coordinate storage
- ✅ **Background Operation**: Continues tracking when tab is in background (limited)

### Metrics & Analytics
- ✅ **NPI Calculation**: Normalized Performance Index tracking (matching iOS formula)
- ✅ **Pace Tracking**: Real-time pace calculation (seconds per km)
- ✅ **Distance Tracking**: GPS-based distance measurement using Haversine formula
- ✅ **Heart Rate Simulation**: Simulated heart rate (placeholder for future sensor integration)
- ✅ **Time to Beat**: Projected time to reach target NPI
- ✅ **Progress Tracking**: Visual progress indicator toward target NPI
- ✅ **Menu Charts Section**: Dedicated `/menu` page for informative charts
- ✅ **Max KPS Pace/Duration Chart**: Pace-over-duration graph using max KPS per duration bucket with click-to-view point tooltips

### Homepage / Dashboard
- ✅ **NPI Showcase**: Prominent display of Best, Average, and Target NPI
- ✅ **Progress Indicator**: Visual progress toward target NPI
- ✅ **Recent Runs**: Quick view of last 3 runs
- ✅ **Quick Actions**: Start run, view history, settings

### Run Tracking View
- ✅ **Large NPI Display**: NPI as the star feature with circular progress gauge
- ✅ **Desktop Panel Layout**: Two-column desktop dashboard with live metrics and controls
- ✅ **Real-time Metrics**: Pace, distance, time, heart rate
- ✅ **GPS Status**: Real-time GPS status indicator (ready/searching/poor/denied)
- ✅ **Time to Beat**: Dynamic projection of time needed to hit target
- ✅ **Control Buttons**: Start, pause, resume, stop
- ✅ **Save Dialog**: Confirm before saving runs

### History View
- ✅ **Run History List**: Paginated list of saved runs (newest first)
- ✅ **Run Cards**: Date, activity name (from notes / import title), distance, duration, pace, weight, KPS; gold / silver / bronze medals for the top three rounded relative KPS tiers across visible history, with `KPS 100` always gold when present (ties share the same medal)
- ✅ **Filters**: Optional filters by name text, pace range (per km or per mi), duration, distance, relative KPS (min/max), source; preset to hide unrealistically fast paces (e.g. car); when filters are on, matching runs are loaded from the full history client-side and shown in a single scrollable list (no per-page slice); with a KPS range filter, the personal-best reference run is pinned to the top
- ✅ **Run Detail Navigation**: Expand for detailed run analysis

### Run Detail View
- ✅ **KPS / stats**: Relative score, distance, duration, pace, heart rate, splits when present
- ✅ **True PB badge** (History expanded details): The actual all-time best activity is identified as `KPS 100`; other runs scale relative to that true best
- ✅ **AI Coach Analysis**: Get AI-powered insights about the run
- ✅ **Route Info**: Display number of GPS points recorded

### Settings View
- ✅ **Target NPI Configuration**: Set and adjust target NPI
- ✅ **Find My Target NPI**: Calculate target from race results
- ✅ **Unit System**: Toggle between metric and imperial
- ✅ **Physio-Pacer Mode**: Toggle heart rate monitoring mode
- ✅ **Data Management**: Clear all data option
- ✅ **Garmin import**: Full Connect export ZIP (`DI_CONNECT/.../summarizedActivities.json`), a ZIP that only contains `.fit` files, or a single running `.fit` file; imports merge into local history with deduplication
- ✅ **Strava import**: OAuth connect and import running activities from Strava
- ✅ **Withings scale**: OAuth connect; on each app load, background sync refreshes tokens, pulls ~90 days of weigh-ins into local weight history, and updates latest weight; run history shows weight-at-date from that history when available (not only the weight snapshot stored on each run)

### AI Integration
- ✅ **Local LLM Support**: Integration with Ollama for local AI analysis
- ✅ **Fallback Analysis**: Rule-based analysis when LLM unavailable
- ✅ **Run Analysis**: AI-powered insights and recommendations
- ✅ **Configurable**: Environment variables for Ollama URL and model

### Data Persistence
- ✅ **localStorage**: Run data and settings stored locally
- ✅ **Run Storage**: All runs saved and retrievable
- ✅ **Settings Storage**: User preferences persisted
- ✅ **Optional song metadata**: Runs may include `songTitle`, `songArtist`, `songBpm` (IndexedDB); Supabase `kinetix.activities` mirrors these columns (`song_bpm` checked **40–240** when set); all optional; coach/RAG may relate BPM to cadence for efficiency hints

### UI/UX
- ✅ **Modern Design**: Dark theme with glassmorphism effects
- ✅ **Responsive Layout**: Works on desktop and mobile
- ✅ **Web Shell Navigation**: Desktop-first header/sidebar with mobile bottom navigation
- ✅ **Smooth Animations**: Transitions and progress indicators
- ✅ **Status Indicators**: Visual feedback for GPS and run state
- ✅ **Error Handling**: User-friendly error messages

## ❌ Missing Features / Limitations

### Not Implemented
- ❌ **Form Metrics**: No cadence, vertical oscillation, ground contact time, stride length
- ❌ **Form Score**: No form quality scoring
- ❌ **HealthKit Integration**: Cannot access HealthKit (browser limitation)
- ❌ **Real Heart Rate**: Currently simulated (no sensor access)
- ❌ **Map Visualization**: Route data collected but not visualized on map
- ❌ **Export/Share Runs**: Cannot export to GPX/TCX or share
- ❌ **Battery Profiles**: No battery management (not applicable for web)
- ❌ **Activity Presets**: No workout presets (Kinetix, Race Mode, etc.)
- ❌ **Watch Connectivity**: Cannot connect to Apple Watch
- ❌ **Voice Coaching**: No text-to-speech or voice alerts
- ❌ **Haptic Feedback**: No haptic feedback (browser limitation)
- ❌ **Background Tracking**: Limited when tab is not active
- ❌ **Crash Recovery**: No automatic recovery of interrupted runs
- ❌ **Training Distribution**: No training analysis charts
- ❌ **Activity Builder**: Cannot create custom workout templates

### Platform Limitations
- ⚠️ **Browser Permissions**: Requires user to grant location permissions
- ⚠️ **No Sensor Access**: Cannot access device sensors (accelerometer, gyroscope)
- ⚠️ **No HealthKit**: Cannot integrate with health data
- ⚠️ **Limited Background**: Tracking may pause when tab is inactive
- ⚠️ **No Native Features**: Cannot use native iOS/watchOS features
- ⚠️ **Storage Limits**: localStorage has size limitations (may need IndexedDB upgrade)

### Future Enhancements
- 🔮 **Map Visualization**: Display route on interactive map (Leaflet/Mapbox)
- 🔮 **Form Metrics Simulation**: Simulate form metrics based on pace/cadence patterns
- 🔮 **Real Heart Rate**: Integration with Web Bluetooth API for heart rate monitors
- 🔮 **Export Features**: Export runs to GPX/TCX format
- 🔮 **PWA Support**: Make installable as Progressive Web App
- 🔮 **Offline Support**: Service worker for offline functionality
- 🔮 **IndexedDB Migration**: Upgrade from localStorage to IndexedDB for larger datasets
- 🔮 **Social Features**: Sharing, leaderboards (optional)
- 🔮 **Training Plans**: Advanced training plan features
- 🔮 **Activity Presets**: Implement workout presets similar to Watch app

---

**Last Updated**: 2026-03-05
**Platform**: Modern Browsers (Chrome, Firefox, Safari, Edge)
**Status**: In Development









