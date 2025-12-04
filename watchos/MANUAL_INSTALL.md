# Manual Installation Workaround

Since Xcode's direct deployment is failing, try this workaround:

## Method 1: Build Archive and Install via iPhone

### Step 1: Build Archive
1. In Xcode, select **KinetixPhone** scheme
2. **Product → Archive**
3. Wait for archive to complete

### Step 2: Export for Development
1. In Organizer (Window → Organizer), select the archive
2. Click **"Distribute App"**
3. Choose **"Development"**
4. Select your team
5. Export to a folder

### Step 3: Install via iPhone
1. The exported folder will contain `.ipa` files
2. Install the iPhone app on your iPhone
3. The Watch app should install automatically via the iPhone Watch app

## Method 2: Use Xcode's Devices Window

1. **Window → Devices and Simulators**
2. Select your **iPhone** (not Watch)
3. Click **"Installed Apps"** tab
4. Click **"+"** button
5. Navigate to the built `.app` file
6. Install it

## Method 3: Force Install via Command Line

```bash
# Build the app
cd watchos
xcodebuild -project KinetixWatch.xcodeproj \
  -scheme KinetixPhone \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  build CODE_SIGNING_ALLOWED=YES

# The Watch app will be embedded in the iPhone app
# Install the iPhone app, and the Watch app should install automatically
```

## Method 4: Check if Watch App is Actually Built

The Watch app might be building but not deploying. Check:

```bash
# Find the built Watch app
find ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-watchos -name "KinetixWatch.app"
```

If it exists, the build is working - it's just the deployment that's failing.

## Method 5: Re-pair Watch (Nuclear Option)

If nothing else works:

1. **On iPhone**: Settings → Watch → [Your Watch] → Unpair Apple Watch
2. **In Xcode**: Window → Devices and Simulators → Right-click Watch → Remove
3. Re-pair the Watch
4. Rebuild and try again

## Method 6: Check Xcode Version Compatibility

Sometimes Xcode 15+ has issues with Watch deployment. Try:
- Updating Xcode to latest version
- Or checking if there's a known issue with your Xcode version

## Most Reliable: Install via iPhone Watch App

**This is the most reliable method:**

1. Build the iPhone app (KinetixPhone scheme) and run it on iPhone
2. On iPhone, open the **Watch app**
3. Scroll to **"Kinetix"**
4. If it shows **"Not Installed"**, tap **"Install"**
5. Wait for installation (1-2 minutes)
6. Once installed, Xcode should be able to deploy updates

The key is: **The Watch app MUST be installed via the iPhone Watch app first** before Xcode can deploy to it directly.


