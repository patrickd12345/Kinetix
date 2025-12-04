# Garmin FIT SDK Integration Guide

This document explains how to integrate the official Garmin FIT SDK to enable FIT file export in the Kinetix app.

## Overview

The FIT export functionality uses Garmin's official FIT SDK, which provides Objective-C/C++ libraries with Swift bridging headers. This is the canonical and supported way to create FIT files on iOS.

## Download the SDK

1. Visit Garmin's Developer Portal: https://developer.garmin.com/fit/download/
2. Download the latest FIT SDK (includes Objective-C wrappers)
3. Extract the ZIP file

## Integration Steps

### Option 1: Manual Integration (Recommended for XcodeGen projects)

1. **Copy SDK Files to Project:**
   ```bash
   # Create a directory for the SDK
   mkdir -p ios/KinetixPhone/FITSDK
   
   # Copy the Objective-C SDK files from the extracted SDK
   # Typically located in: fit-sdk/objective-c/
   ```

2. **Add to Xcode Project:**
   - Open the generated Xcode project
   - Right-click on `KinetixPhone` target → "Add Files to KinetixPhone"
   - Select the FIT SDK directory
   - Ensure "Copy items if needed" is checked
   - Add to target: `KinetixPhone`

3. **Configure Bridging Header:**
   - Xcode will automatically create a bridging header if it doesn't exist
   - Add to `KinetixPhone-Bridging-Header.h`:
     ```objc
     #import "FitSDK.h"
     // Or the specific header files from the SDK
     ```

4. **Update Build Settings:**
   - In Xcode, go to Build Settings for `KinetixPhone` target
   - Search for "Swift Compiler - General"
   - Add the bridging header path if needed
   - Add `GARMIN_FIT_SDK_AVAILABLE=1` to "Other Swift Flags" (Preprocessor Macros)

### Option 2: Swift Package Manager (if available)

If Garmin provides a Swift Package, you can add it via:

1. In Xcode: File → Add Package Dependencies
2. Enter the package URL (if available from Garmin)
3. Add to `KinetixPhone` target

### Option 3: Update project.yml (XcodeGen)

If you want to automate the integration in `project.yml`, you can add:

```yaml
targets:
  KinetixPhone:
    sources:
      - path: ../ios/KinetixPhone
      - path: FITSDK  # If you place SDK here
    settings:
      SWIFT_OBJC_BRIDGING_HEADER: ../ios/KinetixPhone/KinetixPhone-Bridging-Header.h
      OTHER_SWIFT_FLAGS: -DGARMIN_FIT_SDK_AVAILABLE=1
```

## SDK API Usage

The FIT SDK provides a simple API pattern:

```swift
let encoder = FitEncoder()
encoder.write(fileIdMessage)
encoder.write(recordMessage)
// ... more messages
encoder.close()
let fitData = encoder.data
```

### Message Types

- **FileIdMessage**: Identifies the file type (required)
- **ActivityMessage**: Activity metadata
- **SessionMessage**: Session/lap summary
- **LapMessage**: Lap boundaries
- **RecordMessage**: Individual track points (GPS, HR, cadence)

## Implementation Status

The FIT export implementation is already coded in `RunExporter.swift` but is currently disabled via `#if GARMIN_FIT_SDK_AVAILABLE`.

Once the SDK is integrated:
1. Define `GARMIN_FIT_SDK_AVAILABLE=1` in build settings
2. The code will compile and FIT export will be available in the export menu

## Testing

After integration:
1. Build the app (should compile without errors)
2. Run a test run or use existing run data
3. Go to History → Select a run → Export menu
4. "Export FIT" option should be available
5. Share the .fit file to verify it opens in Garmin Connect, Strava, etc.

## Troubleshooting

**Build Errors:**
- Ensure bridging header is configured correctly
- Check that all SDK files are added to the target
- Verify `GARMIN_FIT_SDK_AVAILABLE` is defined

**Runtime Errors:**
- Check that message types match SDK version
- Verify timestamp formats (FIT uses specific time encoding)
- Ensure position coordinates are in semicircles format

## References

- Garmin FIT SDK Documentation: https://developer.garmin.com/fit/overview/
- FIT File Format Specification: https://developer.garmin.com/fit/protocol/
- Example Code: Check the SDK's example programs for reference implementations


