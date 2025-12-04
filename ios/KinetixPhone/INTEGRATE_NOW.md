# 🚀 Integrate FIT SDK - Do This Now

## TL;DR - Quick Steps

1. **Download SDK**: https://developer.garmin.com/fit/download/ (requires free account)
2. **Extract ZIP** and copy `objective-c/` folder contents to `ios/KinetixPhone/FITSDK/`
3. **Update bridging header** with correct import paths
4. **Uncomment settings** in `watchos/project.yml`
5. **Regenerate project**: `cd watchos && xcodegen generate`
6. **Build**: Should work! ✅

---

## Detailed Steps

### Step 1: Download SDK (2 minutes)

1. Go to: https://developer.garmin.com/fit/download/
2. Create account (free) or log in
3. Download the FIT SDK ZIP file
4. Extract it somewhere (e.g., `~/Downloads/fit-sdk/`)

### Step 2: Copy Files (1 minute)

```bash
# From project root
cd /Users/patrickduchesneau/Projects/Kinetix

# Create directory
mkdir -p ios/KinetixPhone/FITSDK

# Copy Objective-C SDK files
# Replace /path/to/extracted with your actual path
cp -r ~/Downloads/fit-sdk/objective-c/* ios/KinetixPhone/FITSDK/
```

**Or manually:**
- Open Finder
- Navigate to extracted `fit-sdk/objective-c/` folder
- Select all files (Cmd+A)
- Copy (Cmd+C)
- Navigate to `ios/KinetixPhone/FITSDK/`
- Paste (Cmd+V)

### Step 3: Update Bridging Header (1 minute)

Open `ios/KinetixPhone/KinetixPhone-Bridging-Header.h` and:

1. Check what header files are in `FITSDK/` directory
2. Uncomment and update the import statement:

```objc
// Look in FITSDK/ folder to see the actual header file names
// Common names: FitSDK.h, FitEncoder.h, FitMessages.h, etc.

#import "FITSDK/FitSDK.h"  // Adjust path based on actual SDK structure
```

**To find the right header:**
```bash
ls ios/KinetixPhone/FITSDK/*.h
```

### Step 4: Update project.yml (30 seconds)

Open `watchos/project.yml` and uncomment these lines in the `KinetixPhone` target settings:

```yaml
# Change from:
# SWIFT_OBJC_BRIDGING_HEADER: ../ios/KinetixPhone/KinetixPhone-Bridging-Header.h
# OTHER_SWIFT_FLAGS: -DGARMIN_FIT_SDK_AVAILABLE=1

# To:
SWIFT_OBJC_BRIDGING_HEADER: ../ios/KinetixPhone/KinetixPhone-Bridging-Header.h
OTHER_SWIFT_FLAGS: -DGARMIN_FIT_SDK_AVAILABLE=1
```

### Step 5: Regenerate & Build (1 minute)

```bash
cd watchos
xcodegen generate
xcodebuild -project KinetixWatch.xcodeproj \
  -scheme KinetixPhone \
  -destination 'generic/platform=iOS' \
  build CODE_SIGNING_ALLOWED=NO
```

### Step 6: Verify (30 seconds)

1. Open the project in Xcode
2. Check that `FITSDK/` files appear in the project navigator
3. Build (Cmd+B) - should succeed
4. Run the app
5. Go to History → Select a run → Export menu
6. **"Export FIT"** should now be available! 🎉

---

## Troubleshooting

### "Cannot find header file"
- Check the import path in bridging header matches the actual file structure
- Verify files are in `ios/KinetixPhone/FITSDK/`
- Try: `#import "FitSDK.h"` (without FITSDK/ prefix) if files are at root

### "Undefined symbols" or linker errors
- Make sure all `.m` files from SDK are added to the target
- In Xcode: Select SDK files → Target Membership → Check "KinetixPhone"

### Build succeeds but FIT export still disabled
- Verify `OTHER_SWIFT_FLAGS` includes `-DGARMIN_FIT_SDK_AVAILABLE=1`
- Clean build folder (Cmd+Shift+K) and rebuild

### Need to see what's in the SDK?
```bash
ls -la ios/KinetixPhone/FITSDK/
```

---

## What Success Looks Like

✅ SDK files in `ios/KinetixPhone/FITSDK/`  
✅ Bridging header imports the SDK  
✅ `project.yml` has uncommented settings  
✅ Project builds without errors  
✅ "Export FIT" appears in export menu  
✅ FIT files can be shared and opened in Garmin Connect/Strava  

---

## Need Help?

Check the detailed guide: `FIT_SDK_INTEGRATION.md`  
Or the quick reference: `QUICK_START_FIT.md`




