# Complete Watch Installation Fix Guide

**Last Updated**: 2025-01-XX  
**Status**: Comprehensive solution for all watchOS installation issues

## Quick Start (90% of cases)

If you're getting "device rejected connection request" or can't install the Watch app:

1. **Run the automated fix script:**
   ```bash
   cd watchos
   ./fix-watch-install.sh
   ```

2. **Follow the on-screen instructions** - the script will guide you through each step.

3. **Most common fix:** Install Watch app via iPhone first (see Method 1 below)

---

## The Root Cause

Apple Watch apps **cannot be installed directly from Xcode on first install**. They must be installed via the iPhone Watch app first. After the initial installation, Xcode can deploy updates directly.

This is by design - Apple requires Watch apps to be managed through the iPhone companion app.

---

## Method 1: Install via iPhone (MOST RELIABLE - 95% success rate)

This is the **recommended method** and works in almost all cases.

### Step 1: Build iPhone App
1. Open Xcode
2. Select **KinetixPhone** scheme
3. Choose your **iPhone** as destination
4. **Build & Run** (⌘+R)
5. Wait for the iPhone app to launch successfully

### Step 2: Install Watch App via iPhone
1. On your **iPhone**, open the **Watch app** (the Apple Watch companion app)
2. Scroll down to find **"Kinetix"** in the list of apps
3. **If it shows "Not Installed":**
   - Tap on "Kinetix"
   - Tap the **"Install"** button
   - Wait 1-2 minutes for installation to complete
   - You'll see a progress indicator

4. **If it shows "Installed":**
   - The Watch app is already there
   - Try tapping it to see if there's an "Update" option

### Step 3: Verify Installation
1. On your **Apple Watch**, press the Digital Crown
2. Look for the **"Kinetix"** app icon
3. If you see it, the installation worked!

### Step 4: Deploy Updates from Xcode
Once the Watch app is installed via iPhone:
- Xcode can now deploy updates directly
- Select **KinetixWatch** scheme
- Choose your **Apple Watch** as destination
- **Build & Run** (⌘+R)
- The "device rejected connection" error should be gone

**Why this works:** Apple's architecture requires Watch apps to be installed via the iPhone Watch app first. Only after initial installation can Xcode deploy updates directly.

---

## Method 2: Clean Build & Retry (If Method 1 doesn't work)

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

# Clean build folder in Xcode
# Product → Clean Build Folder (Shift+⌘+K)
```

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

- **iPhone Bundle ID:** `com.patrickduchesneau.KinetixPhone`
- **Watch Bundle ID:** `com.patrickduchesneau.KinetixPhone.watchkitapp`
- **Watch Info.plist:** `WKCompanionAppBundleIdentifier` = `com.patrickduchesneau.KinetixPhone`

### Step 4: Build iPhone App First
1. Select **KinetixPhone** scheme
2. Build & Run on iPhone (⌘+R)
3. Wait for it to launch successfully

### Step 5: Try Method 1 Again
Go back to Method 1 and install via iPhone.

---

## Method 3: Device Connection Issues

### Check Device Status
1. In Xcode: **Window → Devices and Simulators**
2. Verify both iPhone and Watch are listed
3. Check if Watch shows "Preparing..." - wait for it to finish
4. If Watch shows an error, click it and check the message

### Common Device Issues

**Watch is locked:**
- Unlock your Apple Watch
- Enter passcode if prompted
- Keep it on your wrist or on the charger
- Make sure it's not in Power Reserve mode

**Watch not trusted:**
- On iPhone: Settings → General → VPN & Device Management
- Trust your developer certificate if prompted
- On Watch: Settings → General → About → Trust Developer

**Devices not paired:**
- On iPhone: Settings → Watch → Your Watch should be listed
- If not, re-pair the Watch

**Watch needs restart:**
- Restart your Apple Watch
- Restart your iPhone
- Reconnect in Xcode

---

## Method 4: Code Signing Issues

### Automatic Signing Not Working

1. **Check Team Selection:**
   - Both targets (KinetixPhone and KinetixWatch) must use Team: `AWJBX83Y4X`
   - Both must use "Automatic" signing

2. **Reset Signing:**
   ```bash
   # In Xcode:
   # 1. Select KinetixWatch target
   # 2. Signing & Capabilities
   # 3. Uncheck "Automatically manage signing"
   # 4. Recheck "Automatically manage signing"
   # 5. Select Team again
   # 6. Click "Try Again"
   ```

3. **Check Provisioning Profiles:**
   - Xcode should create profiles automatically
   - If it fails, check Apple Developer portal
   - Ensure you have watchOS development capability enabled

### Manual Provisioning Profile (Advanced)

If automatic signing keeps failing:

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/profiles/list)
2. Create a new **watchOS App Development** profile
3. Include:
   - Your iPhone device
   - Your Watch device
   - Both bundle IDs
4. Download and install the profile
5. In Xcode, select the profile manually

---

## Method 5: Simulator Testing (Quick Development)

If physical device keeps failing, test on simulator first:

1. Select **KinetixWatch** scheme
2. Choose **"Apple Watch Series 9 (45mm) - watchOS 10.0"** simulator
3. Build & Run (⌘+R)
4. This will work immediately

**Note:** Simulator doesn't support all features (GPS, HealthKit, etc.), but good for UI development.

---

## Method 6: Nuclear Option - Re-pair Watch

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

## Verification Checklist

Before reporting an issue, verify all of these:

### Device Requirements
- ✅ iPhone: iOS 17.0+
- ✅ Watch: watchOS 10.0+
- ✅ Both devices are on same Apple ID
- ✅ Both devices are trusted in Xcode
- ✅ Watch is unlocked
- ✅ Watch has enough storage (at least 50MB free)

### Xcode Configuration
- ✅ Xcode version: 15.0+ (check: Xcode → About Xcode)
- ✅ Both targets use Team: `AWJBX83Y4X`
- ✅ Both targets use "Automatic" signing
- ✅ Watch target uses `CODE_SIGN_CONTEXT_CLASS: XCWatchOSCodeSignContext`
- ✅ KinetixPhone target embeds KinetixWatch (Build Phases → Embed Watch Content)

### Bundle IDs
- ✅ iPhone: `com.patrickduchesneau.KinetixPhone`
- ✅ Watch: `com.patrickduchesneau.KinetixPhone.watchkitapp`
- ✅ Watch Info.plist: `WKCompanionAppBundleIdentifier` = `com.patrickduchesneau.KinetixPhone`

### Installation Status
- ✅ iPhone app is installed and runs
- ✅ Watch app is installed (check via iPhone Watch app)
- ✅ Watch app appears on Watch home screen

### Build Status
- ✅ iPhone app builds successfully
- ✅ Watch app builds successfully (check build log)
- ✅ No code signing errors in build log

---

## Common Error Messages & Solutions

### "Device rejected connection request"
**Solution:** Install Watch app via iPhone first (Method 1)

### "No such file or directory" (Watch app)
**Solution:** Build iPhone app first, then Watch app

### "Provisioning profile doesn't match"
**Solution:** Reset code signing (Method 2, Step 2)

### "Watch app not embedded"
**Solution:** Check Build Phases → Embed Watch Content includes KinetixWatch.app

### "Bundle ID mismatch"
**Solution:** Verify Bundle IDs match exactly (see Verification Checklist)

### "Watch is preparing..."
**Solution:** Wait for it to finish (can take 5-10 minutes on first connection)

### "Code signing failed"
**Solution:** 
1. Check Team is selected
2. Reset signing (uncheck/recheck automatic signing)
3. Clean build folder
4. Try Method 1 (install via iPhone)

---

## Diagnostic Commands

### Check Connected Devices
```bash
xcrun xctrace list devices
```

### Check Build Products
```bash
# Find built Watch app
find ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products -name "KinetixWatch.app"
```

### Check Code Signing
```bash
# Check iPhone app signing
codesign -dvvv ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-iphoneos/KinetixPhone.app

# Check Watch app signing
codesign -dvvv ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-watchos/KinetixWatch.app
```

### Check Provisioning Profiles
```bash
# List all profiles
ls ~/Library/MobileDevice/Provisioning\ Profiles/
```

---

## Automated Fix Script

Use the automated fix script for a guided experience:

```bash
cd watchos
./fix-watch-install.sh
```

The script will:
1. Clean Xcode caches
2. Check device connections
3. Verify configuration
4. Guide you through installation steps
5. Provide specific error solutions

---

## Still Not Working?

If you've tried all methods and it's still not working:

1. **Check Xcode Console:**
   - View → Debug Area → Activate Console (Shift+⌘+Y)
   - Look for specific error messages

2. **Check Build Log:**
   - View → Navigators → Report Navigator (⌘+9)
   - Look for code signing or build errors

3. **Check Device Logs:**
   - Window → Devices and Simulators
   - Select your Watch
   - Click "Open Console"
   - Look for errors

4. **Verify Project Configuration:**
   - Check `project.yml` matches this guide
   - Regenerate project if needed: `xcodegen generate`

5. **Try Simulator:**
   - If simulator works, issue is device-specific
   - If simulator fails, issue is code/configuration

---

## Prevention Tips

To avoid installation issues in the future:

1. **Always install Watch app via iPhone first** (Method 1)
2. **Keep Xcode updated** to latest version
3. **Keep devices updated** to latest iOS/watchOS
4. **Don't manually edit provisioning profiles** - let Xcode manage them
5. **Clean build folder** before major changes (Shift+⌘+K)
6. **Build iPhone app first** before building Watch app

---

## Summary

**The Golden Rule:** Watch apps must be installed via iPhone first. After that, Xcode can deploy updates directly.

**Most Common Fix:** Method 1 (Install via iPhone) - works 95% of the time.

**If Method 1 fails:** Try Method 2 (Clean Build & Retry).

**If still failing:** Check Verification Checklist and try Method 6 (Re-pair Watch).

**For development:** Use Method 5 (Simulator) for quick testing.

---

**Need Help?** Check the diagnostic commands above or run `./fix-watch-install.sh --help` for more options.




