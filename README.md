# KINETIX 🏃‍♂️

**AI-Powered Running Coach with NPI (Normalized Performance Index)**

[![Version](https://img.shields.io/badge/version-1.0--rc-blue.svg)](https://github.com/patrickd12345/Kinetix)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📖 Overview

Kinetix is a revolutionary running coach application that uses a proprietary **Normalized Performance Index (NPI)** to provide real-time performance tracking and coaching. Unlike traditional pace-based systems, NPI adjusts for fatigue over distance, giving runners a more accurate measure of their performance potential.

### Key Innovation: Normalized Performance Index (NPI)

NPI is a unique metric that:
- **Normalizes speed** for fatigue over distance
- **Provides real-time feedback** on performance relative to your target
- **Projects finish times** based on current average pace
- **Adapts dynamically** as your pace changes during the run

---

## ✨ Features

### 🎯 Core Features

- **Real-Time NPI Tracking**: Live performance index that adjusts for distance and fatigue
- **Dynamic Target System**: Set and adjust your target NPI during runs
- **Time-to-Beat Projection**: See exactly how long you need to maintain your current pace to hit your target
- **Visual Progress Indicators**: 
  - Circular gauge showing time-based progress
  - Linear runner track with animated progress
- **GPS Integration**: Real-time location tracking with GPS fix detection
- **Physio-Pacer Mode**: Cardiac drift detection with recommended pace adjustments
- **Race History**: Log and analyze past performances
- **Find My Target NPI**: Calculate your target NPI from previous race data

### 🎨 User Interface

- **Watch-Optimized Design**: Apple Watch Ultra form factor (410x502px)
- **Vertical Scroll Navigation**: Native watchOS-style page navigation
- **Modern UI**: Glassmorphism effects, gradients, and smooth animations
- **Dark Theme**: Optimized for outdoor visibility
- **Responsive Feedback**: Haptic-ready design for native watch integration

### 🤖 AI Coach (Optional)

- **Gemini AI Integration**: Post-run analysis and recommendations
- **Performance Insights**: Scientific feedback on your running data
- **Customizable**: Enable/disable as needed

---

## 🏗️ Architecture

### Project Structure

```
Kinetix/
├── watchos/
│   └── KinetixWatch/
│       └── ContentView.swift          # Native Apple Watch app (SwiftUI)
├── web/
│   ├── src/
│   │   ├── KinetixMaxPrototype.jsx   # Main React component
│   │   ├── main.jsx                  # Entry point
│   │   └── index.css                 # Global styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js                # Vite configuration
│   ├── tailwind.config.js             # Tailwind CSS config
│   └── postcss.config.js
└── README.md
```

### Technology Stack

**Native Watch App:**
- SwiftUI
- CoreLocation
- SwiftData
- AVFoundation
- watchOS 10+

**Web Prototype:**
- React 18
- Vite
- Tailwind CSS
- Lucide React Icons
- Modern ES6+

---

## 🚀 Getting Started

### Prerequisites

- **For Watch App**: Xcode 15+, watchOS 10+, Apple Watch
- **For Web Prototype**: Node.js 18+, pnpm (or npm)

### Installation

#### Web Prototype

1. **Clone the repository**
   ```bash
   git clone https://github.com/patrickd12345/Kinetix.git
   cd Kinetix/web
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Start development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

4. **Open in browser**
   - Navigate to `http://localhost:5173`
   - The app will display in a watch-sized container

#### Native Watch App

1. **Open in Xcode**
   ```bash
   open watchos/KinetixWatch.xcodeproj
   ```

2. **Configure signing** (if needed)
   - Select the project in Xcode
   - Go to "Signing & Capabilities"
   - Select your development team
   - Location Services capability is already configured

3. **Build and run**
   - Select your Apple Watch as the target (simulator or device)
   - Build and run (⌘R)

---

## 🔑 API Keys Setup

### Gemini AI Coach (Optional)

To enable the AI Coach feature:

1. **Get a Gemini API Key**
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Create a new API key

2. **Add to Web Prototype**
   - Edit `web/src/KinetixMaxPrototype.jsx`
   - Replace `"PASTE_KEY_HERE"` on line 6 with your API key

3. **Add to Watch App**
   - Edit `watchos/KinetixWatch/ContentView.swift`
   - Replace `"PASTE_KEY_HERE"` on line 6 with your API key

---

## 📱 Usage Guide

### Starting a Run

1. **Set Your Target NPI**
   - Navigate to Settings (swipe up from Run screen)
   - Adjust Target NPI using `--`, `-`, `+`, `++` buttons
   - Or use "Find my target NPI" to calculate from a previous race

2. **Wait for GPS Fix**
   - Status indicator shows:
     - **WAITING** (gray): GPS not available
     - **READY** (green): GPS fix obtained
     - **LIVE** (cyan): Currently running

3. **Start Tracking**
   - Tap the green play button
   - The app begins tracking distance, pace, and calculating NPI

### During Your Run

- **Main Display**: Shows your current NPI vs target
- **Circular Gauge**: Progress toward target (time-based)
- **Runner Track**: Visual progress indicator
- **Time to Beat**: Projected time remaining at current pace
- **Stats**: Pace, Distance, Heart Rate (if Physio mode enabled)

### Understanding the Display

- **NPI Number**: Your current Normalized Performance Index
- **Target Badge**: Your goal NPI
- **Progress Indicators**: 
  - Green = Target reached/exceeded
  - Cyan = Working toward target
- **Time Projection**: Format `MM:SS @ AVG MM:SS`
  - First time = Remaining time to beat target
  - Second time = Your current average pace

### Settings

- **Target NPI**: Fine (`-`/`+`) or coarse (`--`/`++`) adjustments
- **Physio-Pacer**: Enable cardiac drift detection
- **Units**: Switch between Metric (km) and Imperial (miles)

### History

- View logged races and their NPI values
- Races added via "Find my target NPI" feature
- Shows date, distance, time, and calculated NPI

---

## 🧮 NPI Formula

The Normalized Performance Index is calculated as:

```
NPI = (Speed in km/h) × (Distance Factor) × 10

Where:
- Speed = (1000 / pace_seconds) × 3.6
- Distance Factor = (distance_km)^0.06
```

This formula:
- **Rewards consistency**: Maintains performance value over distance
- **Accounts for fatigue**: Adjusts for distance-based performance decay
- **Provides actionable metrics**: Directly comparable across different distances

---

## 🎯 Key Concepts

### Normalized Performance Index (NPI)

NPI is a unique metric that normalizes running performance across distances. Unlike pace (which gets slower over distance), NPI maintains its value, making it perfect for:
- Setting consistent performance goals
- Comparing runs of different distances
- Tracking improvement over time

### Time-to-Beat Projection

The app calculates how long you need to maintain your current average pace to reach your target NPI. This updates in real-time as your pace changes.

### Physio-Pacer Mode

When enabled, the app monitors heart rate and detects "cardiac drift" - when heart rate increases while pace stays constant. This indicates fatigue, and the app suggests a recovery pace.

---

## 🛠️ Development

### Building for Production

**Web:**
```bash
cd web
pnpm build
```

Output will be in `web/dist/`

### Code Structure

- **`useLocationManager`**: Core running logic and NPI calculations
- **`useAICoach`**: Gemini AI integration
- **Components**: Modular React components for UI elements
- **State Management**: React hooks for local state

### Key Functions

- `calculateNPIFromRace()`: Calculate NPI from race data
- `toggleTracking()`: Start/stop run tracking
- `updateCalculations()`: Recalculate NPI and projections

---

## 🧪 Testing

### Web Prototype

The web prototype simulates:
- GPS tracking (distance accumulation)
- Heart rate (gradual increase)
- Real-time NPI calculations
- All UI interactions

### Native Watch App

Requires:
- Physical Apple Watch
- Xcode Simulator (limited GPS simulation)
- Real device for full GPS testing

---

## 📋 Requirements

### Watch App
- watchOS 10.0+
- Xcode 15.0+
- Apple Watch (Series 4+ recommended)

### Web Prototype
- Modern browser (Chrome, Safari, Firefox, Edge)
- JavaScript enabled
- Optional: GPS access for location features

---

## 🐛 Known Issues

- Web prototype uses simulated GPS (for demo purposes)
- AI Coach requires valid Gemini API key
- History data is stored in memory (not persisted)

---

## 🚧 Roadmap

- [ ] Persistent storage for run history
- [ ] Cloud sync for runs across devices
- [ ] Advanced analytics and trends
- [ ] Social features and challenges
- [ ] Integration with Strava, Garmin, etc.
- [ ] Training plans based on NPI
- [ ] Weather integration for performance adjustments

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **Concept**: Unique NPI-based running coaching system
- **Design**: Modern watchOS-inspired UI
- **AI Integration**: Google Gemini API
- **Icons**: Lucide React

---

## 📞 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing documentation
- Review the Quick Info section in the app

---

## 🎉 Version History

### v1.0 (Release Candidate) - November 27, 2025
- Initial release
- Core NPI calculation and tracking
- Watch-optimized UI
- AI Coach integration
- Race history logging
- GPS fix detection
- Physio-Pacer mode

---

**Built with ❤️ for runners who want to push their limits**
