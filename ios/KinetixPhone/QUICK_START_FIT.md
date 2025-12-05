# Quick Start: FIT SDK Integration

## Step-by-Step Integration (5 minutes)

### 1. Download the SDK

1. **Visit**: https://developer.garmin.com/fit/download/
2. **Log in** (or create a free developer account)
3. **Download** the FIT SDK ZIP file
4. **Extract** the ZIP file

### 2. Copy SDK Files

The SDK contains multiple language implementations. We need the **Objective-C** version:

```bash
# From your project root
cd /Users/patrickduchesneau/Projects/Kinetix

# Create SDK directory
mkdir -p ios/KinetixPhone/FITSDK

# Copy the Objective-C SDK files
# The extracted SDK typically has this structure:
# fit-sdk/
#   ├── objective-c/    ← We need this folder
#   ├── c/
#   ├── python/
#   └── ...

# Copy the objective-c folder contents to our project
cp -r /path/to/extracted/fit-sdk/objective-c/* ios/KinetixPhone/FITSDK/
```

**Or manually:**
- Open the extracted `fit-sdk` folder
- Find the `objective-c` folder
- Copy ALL files from `objective-c/` to `ios/KinetixPhone/FITSDK/`

### 3. Update project.yml

I'll update the project.yml file to include the SDK. After that, regenerate the Xcode project:

```bash
cd watchos
xcodegen generate
```

### 4. Create Bridging Header

Create `ios/KinetixPhone/KinetixPhone-Bridging-Header.h`:

```objc
//
//  KinetixPhone-Bridging-Header.h
//  KinetixPhone
//

#ifndef KinetixPhone_Bridging_Header_h
#define KinetixPhone_Bridging_Header_h

// Import Garmin FIT SDK headers
#import "FITSDK/FitSDK.h"
// Or if the SDK uses different header names, import them here
// Example: #import "FITSDK/FitEncoder.h"
// Example: #import "FITSDK/FitMessages.h"

#endif /* KinetixPhone_Bridging_Header_h */
```

### 5. Update Build Settings

After regenerating the project, open it in Xcode:

1. Select **KinetixPhone** target
2. Go to **Build Settings**
3. Search for **"Swift Compiler - General"**
4. Set **Objective-C Bridging Header** to: `ios/KinetixPhone/KinetixPhone-Bridging-Header.h`
5. Search for **"Other Swift Flags"**
6. Add: `-DGARMIN_FIT_SDK_AVAILABLE=1`

### 6. Build and Test

```bash
# Build to verify integration
xcodebuild -project watchos/KinetixWatch.xcodeproj \
  -scheme KinetixPhone \
  -destination 'generic/platform=iOS' \
  build CODE_SIGNING_ALLOWED=NO
```

If it builds successfully, FIT export is ready! 🎉

## What Files Should Be in FITSDK/?

After copying, you should see files like:
- `FitSDK.h` (or similar header files)
- `FitEncoder.h` / `FitEncoder.m`
- `FitMessages.h` / `FitMessages.m`
- Other SDK source files

The exact file names depend on the SDK version, but you should see Objective-C `.h` and `.m` files.

## Troubleshooting

**"Cannot find FitSDK.h"**
- Check the bridging header path
- Verify files are in `ios/KinetixPhone/FITSDK/`
- Update the `#import` path in the bridging header

**"Undefined symbols"**
- Make sure all SDK `.m` files are added to the target
- Check that the SDK files are included in `project.yml` sources

**Build succeeds but FIT export still disabled**
- Verify `GARMIN_FIT_SDK_AVAILABLE=1` is in build settings
- Check that the `#if GARMIN_FIT_SDK_AVAILABLE` code path is being compiled

## Next Steps

Once integrated, the FIT export will automatically appear in the export menu when viewing a run in History!








