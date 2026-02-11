# PWA Installer - Plug and Play Setup

## What is a PWA?

A Progressive Web App (PWA) is a web app that can be installed on your device and run like a native app. Kinetix Web is now a PWA!

## Benefits

- ✅ **Installable** - Add to home screen (desktop/mobile)
- ✅ **Works Offline** - Cached assets work without internet
- ✅ **App-like Experience** - Standalone window, no browser UI
- ✅ **Fast Loading** - Service worker caches resources
- ✅ **Local Ollama** - Connects to your local Ollama instance
- ✅ **Privacy** - Everything runs locally

## Installation

### Desktop (Chrome, Edge, Brave)

1. **Open Kinetix Web App** in your browser
2. **Look for install prompt** (bottom of screen) or:
   - Click the **install icon** in the address bar
   - Or go to menu → "Install Kinetix"
3. **Click "Install"**
4. **Done!** App opens in its own window

### Mobile (iOS Safari)

1. **Open Kinetix Web App** in Safari
2. **Tap Share button** (square with arrow)
3. **Tap "Add to Home Screen"**
4. **Customize name** (optional)
5. **Tap "Add"**
6. **Done!** App icon appears on home screen

### Mobile (Android Chrome)

1. **Open Kinetix Web App** in Chrome
2. **Look for install banner** or:
   - Tap menu (3 dots) → "Install app"
3. **Tap "Install"**
4. **Done!** App icon appears on home screen

## After Installation

- **Desktop**: App opens in standalone window (no browser UI)
- **Mobile**: App opens fullscreen (feels like native app)
- **Ollama**: Still connects to `localhost:11434` (your local machine)
- **Data**: Stored locally in browser (localStorage)

## Requirements

### For Installation
- **HTTPS** (required for PWA - most hosting provides this)
- **Modern browser** (Chrome, Edge, Safari, Firefox)
- **Service worker support** (all modern browsers)

### For Full Functionality
- **Ollama running locally** (for AI features)
- **Location permissions** (for GPS tracking)
- **Modern browser** with Geolocation API

## How It Works

1. **Service Worker** - Caches app assets for offline use
2. **Web App Manifest** - Defines app metadata and icons
3. **Install Prompt** - Browser shows install option
4. **Standalone Mode** - Runs without browser UI when installed

## Development

### Testing PWA Locally

```bash
cd web
npm run dev
```

PWA features work in development mode too!

### Building for Production

```bash
cd web
npm run build
```

Service worker and manifest are automatically generated.

## Customization

### Icons

Place these in `public/`:
- `pwa-192x192.png` - 192x192 icon
- `pwa-512x512.png` - 512x512 icon
- `apple-touch-icon.png` - iOS icon (180x180)
- `favicon.png` - Browser favicon

### Manifest

Edit `vite.config.js` to customize:
- App name
- Theme color
- Display mode
- Icons

## Troubleshooting

### Install prompt not showing
- Make sure you're on HTTPS (or localhost)
- Check browser supports PWA
- Clear browser cache
- Try different browser

### Ollama not connecting
- Make sure Ollama is running: `ollama serve`
- Check `localhost:11434` is accessible
- Verify CORS settings in Ollama

### App not working offline
- Service worker needs to cache resources first
- Visit app while online to cache
- Check browser console for service worker errors

## Advantages Over Native Apps

- ✅ **No App Store** - Direct installation
- ✅ **Cross-platform** - Same code for all platforms
- ✅ **Easy Updates** - Auto-updates when you visit
- ✅ **Smaller Size** - No native binary
- ✅ **Web Technologies** - Easy to develop and maintain

## Limitations

- ⚠️ **Browser Required** - Still needs browser engine
- ⚠️ **Limited Native APIs** - Can't access all device features
- ⚠️ **iOS Limitations** - Safari has some PWA restrictions
- ⚠️ **Local Ollama** - Requires Ollama running locally

## Next Steps

1. **Create Icons** - Generate app icons (192x192, 512x512)
2. **Test Installation** - Try installing on different devices
3. **Configure Ollama** - Set up local Ollama instance
4. **Deploy** - Host on Vercel/Netlify with HTTPS

---

**The PWA installer makes Kinetix feel like a native app while keeping the flexibility of web technologies!**









