#!/bin/bash

# Garmin FIT SDK Integration Script
# This script helps download and integrate the Garmin FIT SDK

set -e

SDK_DIR="FITSDK"
SDK_URL="https://developer.garmin.com/downloads/fit/sdk/fit-sdk.zip"

echo "🔵 Garmin FIT SDK Integration Script"
echo "======================================"
echo ""

# Check if SDK directory already exists
if [ -d "$SDK_DIR" ]; then
    echo "⚠️  SDK directory already exists at: $SDK_DIR"
    echo "   Remove it first if you want to re-download."
    exit 1
fi

echo "📥 Step 1: Downloading Garmin FIT SDK..."
echo "   Note: You may need to download manually from:"
echo "   https://developer.garmin.com/fit/download/"
echo ""
echo "   The SDK requires registration/login on Garmin's developer portal."
echo ""

# Try to download (may require authentication)
if command -v curl &> /dev/null; then
    echo "   Attempting download with curl..."
    mkdir -p "$SDK_DIR"
    cd "$SDK_DIR"
    
    # Note: This will likely fail due to authentication, but we'll provide instructions
    if curl -L -o fit-sdk.zip "$SDK_URL" 2>/dev/null; then
        echo "   ✅ Download successful!"
        unzip -q fit-sdk.zip
        rm fit-sdk.zip
        echo "   ✅ Extracted SDK files"
    else
        echo "   ⚠️  Automatic download failed (likely requires authentication)"
        echo ""
        echo "   📋 Manual Download Instructions:"
        echo "   1. Visit: https://developer.garmin.com/fit/download/"
        echo "   2. Log in or create a developer account"
        echo "   3. Download the FIT SDK (ZIP file)"
        echo "   4. Extract the ZIP file"
        echo "   5. Copy the 'objective-c' folder contents to: $SDK_DIR/"
        echo ""
        cd ..
        rmdir "$SDK_DIR" 2>/dev/null || true
        exit 1
    fi
    cd ..
else
    echo "   ❌ curl not found. Please download manually."
    exit 1
fi

echo ""
echo "✅ SDK files should now be in: $SDK_DIR/"
echo ""
echo "📋 Next Steps:"
echo "   1. Run: xcodegen generate (in watchos/ directory)"
echo "   2. Open Xcode project"
echo "   3. Add bridging header (see FIT_SDK_INTEGRATION.md)"
echo "   4. Build the project"
echo ""



