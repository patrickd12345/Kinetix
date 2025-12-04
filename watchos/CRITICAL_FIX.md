# Critical Fix: Watch Connection Issue

## The Real Problem

The Watch target was missing `CODE_SIGN_STYLE: Automatic` in `project.yml`. This has been fixed.

## What I Just Did

1. ✅ Added `CODE_SIGN_STYLE: Automatic` to KinetixWatch target
2. ✅ Regenerated the Xcode project

## Next Steps (CRITICAL - Do These in Order)

### Step 1: Clean Everything
```bash
cd watchos
./FIX_WATCH_CONNECTION.sh
```

Or manually:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*
```

### Step 2: In Xcode
1. **Quit Xcode completely** (⌘+Q)
2. **Reopen** the project
3. **Product → Clean Build Folder** (Shift+⌘+K)

### Step 3: Fix Signing
1. Select **KinetixWatch** target
2. Go to **Signing & Capabilities**
3. **Uncheck** "Automatically manage signing"
4. **Recheck** "Automatically manage signing"
5. Select your **Team** (AWJBX83Y4X)
6. Click **"Try Again"** if there's an error

### Step 4: Build iPhone App First
1. Select **KinetixPhone** scheme
2. Choose your **iPhone** as destination
3. **Build & Run** (⌘+R)
4. Wait for it to launch successfully

### Step 5: Install Watch App via iPhone
1. On your **iPhone**, open the **Watch app**
2. Scroll to find **"Kinetix"**
3. If it shows **"Not Installed"**:
   - Tap it
   - Tap **"Install"**
   - Wait 1-2 minutes for installation

### Step 6: Build Watch App
1. Select **KinetixWatch** scheme
2. Choose your **Apple Watch** as destination
3. Make sure your **Watch is unlocked**
4. **Build & Run** (⌘+R)

## If Still Failing

### Check Device Status
1. **Window → Devices and Simulators**
2. Check if your Watch shows any errors
3. If it says "Preparing...", wait for it to finish
4. If there's an error, click on it to see details

### Try Simulator First
1. Select **KinetixWatch** scheme
2. Choose **"Apple Watch Series 9 (45mm) - watchOS 10.0"** simulator
3. Build & Run
4. If simulator works, the issue is device-specific

### Nuclear Option
1. In Xcode: **Window → Devices and Simulators**
2. Right-click your Watch → **"Unpair"**
3. On iPhone: **Settings → Watch → Unpair**
4. Re-pair the Watch
5. Rebuild

## Why This Happens

The "device rejected connection request" error usually means:
- Code signing isn't properly configured (now fixed)
- Watch app isn't installed on the Watch (install via iPhone)
- Xcode's device cache is stale (clean it)
- Watch needs to be unlocked (enter passcode)

The missing `CODE_SIGN_STYLE` was likely causing Xcode to fail silently during the signing/preparation phase.


