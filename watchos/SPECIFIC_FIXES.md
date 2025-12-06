# Specific Fixes for "Device Rejected Connection Request"

## Most Likely Causes (in order of probability)

### 1. Watch App Not Installed on Watch
**This is the #1 cause of this error.**

**Fix:**
- On your **iPhone**, open the **Watch app**
- Scroll down to find **"Kinetix"** in the list
- If it shows **"Not Installed"**, tap it
- Tap **"Install"**
- Wait for the installation to complete (can take 1-2 minutes)
- The Watch app must be installed via iPhone first before Xcode can deploy to it

### 2. Watch is Locked or Needs Passcode
**Fix:**
- Unlock your Apple Watch
- Enter passcode if prompted
- Keep it on your wrist or on the charger
- Make sure it's not in Power Reserve mode

### 3. Xcode Device Cache Issue
**Fix:**
```bash
# Run this script
./watchos/FIX_WATCH_CONNECTION.sh

# Or manually:
rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*
```

Then:
- Quit Xcode (Cmd+Q)
- Reopen Xcode
- Product → Clean Build Folder (Shift+Cmd+K)

### 4. Need to Build iPhone App First
**Fix:**
1. Select **KinetixPhone** scheme
2. Build & Run on iPhone (Cmd+R)
3. Wait for iPhone app to launch
4. Then select **KinetixWatch** scheme
5. Build & Run on Watch

### 5. Device Trust Issue
**Fix:**
- In Xcode: **Window → Devices and Simulators**
- Check if your Watch shows "Preparing..." - wait for it to finish
- If Watch shows an error, click it and check the message
- Try disconnecting and reconnecting the Watch

### 6. Provisioning Profile Issue
**Fix:**
- In Xcode, select **KinetixWatch** target
- Go to **Signing & Capabilities**
- Uncheck and recheck **"Automatically manage signing"**
- Select your Team again
- Click **"Try Again"** if there's an error

### 7. Watch Needs to be Re-paired
**Nuclear option:**
- In Xcode: **Window → Devices and Simulators**
- Right-click your Watch → **"Unpair"**
- On your iPhone: Settings → Watch → Unpair
- Re-pair the Watch
- Rebuild in Xcode

## Diagnostic Steps

### Check Device Status
```bash
# List connected devices
xcrun xctrace list devices
```

### Check if Watch App is Installed
- On iPhone: Watch app → Scroll to "Kinetix"
- Should show "Installed" (not "Not Installed")

### Check Xcode Console
- View → Debug Area → Activate Console (Shift+Cmd+Y)
- Look for specific error messages about:
  - Code signing
  - Bundle IDs
  - Device connection
  - Provisioning profiles

## Quick Test: Build for Simulator First

If physical device keeps failing, try simulator:
1. Select **KinetixWatch** scheme
2. Choose **"Apple Watch Series 9 (45mm) - watchOS 10.0"** as destination
3. Build & Run (Cmd+R)
4. If simulator works, the issue is device-specific, not code

## Still Not Working?

Check these specific things:

1. **Bundle IDs match exactly:**
   - iPhone: `com.patrickduchesneau.KinetixPhone`
   - Watch: `com.patrickduchesneau.KinetixPhone.watchkitapp`
   - Watch Info.plist: `WKCompanionAppBundleIdentifier` = `com.patrickduchesneau.KinetixPhone`

2. **Code Signing:**
   - Both targets use Team: `AWJBX83Y4X`
   - Both use "Automatic" signing
   - Watch uses `XCWatchOSCodeSignContext`

3. **Device Requirements:**
   - iPhone: iOS 17.0+
   - Watch: watchOS 10.0+
   - Both devices are on same Apple ID
   - Both devices are trusted in Xcode









