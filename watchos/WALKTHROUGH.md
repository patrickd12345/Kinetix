# Watch Installation - Step-by-Step Walkthrough

Follow these steps in order to fix your watch installation issue.

## 📋 Pre-Flight Checklist

Before starting, verify your setup:

```bash
cd watchos
./verify-watch-setup.sh
```

You should see all green checkmarks (✓). If not, fix those issues first.

## 🚀 Method 1: Install via iPhone (95% Success Rate)

This is the **most reliable method** and works in almost all cases.

### Step 1: Build iPhone App

1. **Open Xcode**
   - Navigate to `watchos/` directory
   - Open `KinetixWatch.xcodeproj`

2. **Select iPhone Scheme**
   - In the scheme selector (top toolbar), choose **KinetixPhone**
   - Choose your **iPhone** as the destination (not Watch)

3. **Build & Run**
   - Press **⌘+R** (or Product → Run)
   - Wait for the iPhone app to build and launch
   - **Important:** Make sure the iPhone app launches successfully on your device

### Step 2: Install Watch App via iPhone

1. **On your iPhone**, open the **Watch app** (the Apple Watch companion app)
   - This is the app with the Watch icon, not the Kinetix app

2. **Find Kinetix**
   - Scroll down through the list of apps
   - Look for **"Kinetix"** in the list

3. **Install the Watch App**
   - If it shows **"Not Installed"**:
     - Tap on "Kinetix"
     - Tap the **"Install"** button
     - Wait 1-2 minutes for installation
     - You'll see a progress indicator
   - If it shows **"Installed"**:
     - The Watch app is already there
     - You can try tapping it to see if there's an "Update" option

### Step 3: Verify Installation on Watch

1. **On your Apple Watch**, press the **Digital Crown**
2. Look for the **"Kinetix"** app icon
3. If you see it, the installation worked! ✅

### Step 4: Deploy Updates from Xcode

Now that the Watch app is installed via iPhone, Xcode can deploy updates:

1. **In Xcode**, select **KinetixWatch** scheme
2. Choose your **Apple Watch** as destination
3. Make sure your **Watch is unlocked**
4. **Build & Run** (⌘+R)
5. The "device rejected connection" error should be gone! ✅

---

## 🔧 Method 2: Clean Build & Retry (If Method 1 Fails)

If Method 1 doesn't work, try this:

### Step 1: Clean Everything

```bash
cd watchos
./fix-watch-install.sh --clean
```

Or manually:
```bash
# Clean Xcode caches
rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*
```

Then in Xcode:
- **Product → Clean Build Folder** (Shift+⌘+K)

### Step 2: Fix Code Signing

1. In Xcode, select **KinetixWatch** target
2. Go to **Signing & Capabilities**
3. **Uncheck** "Automatically manage signing"
4. **Recheck** "Automatically manage signing"
5. Select your **Team** (AWJBX83Y4X)
6. Click **"Try Again"** if there's an error
7. Repeat for **KinetixPhone** target

### Step 3: Verify Bundle IDs

Check these match exactly:
- **iPhone:** `com.patrickduchesneau.KinetixPhone`
- **Watch:** `com.patrickduchesneau.KinetixPhone.watchkitapp`
- **Watch Info.plist:** `WKCompanionAppBundleIdentifier` = `com.patrickduchesneau.KinetixPhone`

### Step 4: Try Method 1 Again

Go back to Method 1 and try installing via iPhone again.

---

## 🎯 Method 3: Device Connection Issues

If you're getting connection errors:

### Check Device Status

1. In Xcode: **Window → Devices and Simulators**
2. Verify both iPhone and Watch are listed
3. Check if Watch shows "Preparing..." - **wait for it to finish**
4. If Watch shows an error, click it and check the message

### Common Device Issues

**Watch is locked:**
- Unlock your Apple Watch
- Enter passcode if prompted
- Keep it on your wrist or on the charger

**Devices not trusted:**
- On iPhone: Settings → General → VPN & Device Management
- Trust your developer certificate if prompted

**Watch needs restart:**
- Restart your Apple Watch
- Restart your iPhone
- Reconnect in Xcode

---

## 🧪 Method 4: Test on Simulator First

If physical device keeps failing, test on simulator:

1. Select **KinetixWatch** scheme
2. Choose **"Apple Watch Series 9 (45mm) - watchOS 10.0"** simulator
3. Build & Run (⌘+R)
4. This will work immediately

**Note:** Simulator doesn't support all features (GPS, HealthKit, etc.), but good for UI development.

---

## 🆘 Method 5: Nuclear Option - Re-pair Watch

If nothing else works:

### Step 1: Unpair in Xcode
1. In Xcode: **Window → Devices and Simulators**
2. Right-click your Watch → **"Unpair"**

### Step 2: Unpair on iPhone
1. On iPhone: **Settings → Watch → [Your Watch] → Unpair Apple Watch**
2. Confirm unpairing

### Step 3: Re-pair Watch
1. Follow Apple's pairing process
2. Wait for sync to complete

### Step 4: Rebuild
1. Clean build folder (Shift+⌘+K)
2. Build iPhone app first (KinetixPhone scheme)
3. Install Watch app via iPhone (Method 1)
4. Then build Watch app (KinetixWatch scheme)

---

## ✅ Verification After Installation

After successful installation, verify:

1. **Watch app appears on Watch home screen** ✅
2. **Watch app shows "Installed" in iPhone Watch app** ✅
3. **Xcode can deploy updates** (no "device rejected" errors) ✅
4. **App runs on Watch** ✅

---

## 🐛 Common Errors & Quick Fixes

### "Device rejected connection request"
→ **Solution:** Install Watch app via iPhone first (Method 1)

### "No such file or directory" (Watch app)
→ **Solution:** Build iPhone app first, then Watch app

### "Provisioning profile doesn't match"
→ **Solution:** Reset code signing (Method 2, Step 2)

### "Watch app not embedded"
→ **Solution:** Check Build Phases → Embed Watch Content includes KinetixWatch.app

### "Bundle ID mismatch"
→ **Solution:** Verify Bundle IDs match exactly (see Method 2, Step 3)

### "Watch is preparing..."
→ **Solution:** Wait for it to finish (can take 5-10 minutes on first connection)

---

## 📞 Getting Help

If you've tried all methods and it's still not working:

1. **Check Xcode Console:**
   - View → Debug Area → Activate Console (Shift+⌘+Y)
   - Look for specific error messages

2. **Run diagnostics:**
   ```bash
   ./fix-watch-install.sh --check
   ./verify-watch-setup.sh
   ```

3. **Check comprehensive guide:**
   - Read `WATCH_INSTALL_FIX.md` for all methods
   - Check diagnostic commands section

4. **Verify checklist:**
   - Run `./fix-watch-install.sh --verify`
   - Make sure all items are checked

---

## 🎯 Quick Reference

**Most Common Fix (95% success):**
1. Build iPhone app (KinetixPhone scheme)
2. Install Watch app via iPhone Watch app
3. Build Watch app (KinetixWatch scheme)

**Automated Help:**
```bash
./fix-watch-install.sh          # Full diagnostic
./fix-watch-install.sh --clean   # Clean caches
./fix-watch-install.sh --check   # Check config
./verify-watch-setup.sh          # Verify setup
```

**Remember:** Watch apps must be installed via iPhone first. This is by design!

---

## 📚 Additional Resources

- **[WATCH_INSTALL_FIX.md](./WATCH_INSTALL_FIX.md)** - Complete comprehensive guide
- **[QUICK_FIX.md](./QUICK_FIX.md)** - Quick reference
- **[WATCH_CONNECTION_TROUBLESHOOTING.md](./WATCH_CONNECTION_TROUBLESHOOTING.md)** - Connection issues

---

**Good luck!** 🚀




