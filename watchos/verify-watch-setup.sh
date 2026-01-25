#!/bin/bash

# Watch Setup Verification Script
# Checks all configuration and setup requirements

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check Xcode
check_xcode() {
    print_header "Xcode Configuration"
    
    if command -v xcodebuild &> /dev/null; then
        XCODE_VERSION=$(xcodebuild -version | head -n 1 | awk '{print $2}')
        print_check 0 "Xcode installed: $XCODE_VERSION"
    else
        print_check 1 "Xcode not found"
        return
    fi
    
    # Check if project can be opened
    if [ -f "KinetixWatch.xcodeproj/project.pbxproj" ]; then
        print_check 0 "Xcode project exists"
    else
        print_check 1 "Xcode project not found"
    fi
}

# Check project configuration
check_project() {
    print_header "Project Configuration"
    
    # Check project.yml
    if [ -f "project.yml" ]; then
        print_check 0 "project.yml exists"
        
        # Check bundle IDs
        if grep -q "com.patrickduchesneau.KinetixPhone" project.yml; then
            print_check 0 "iPhone bundle ID configured"
        else
            print_check 1 "iPhone bundle ID not found"
        fi
        
        if grep -q "com.patrickduchesneau.KinetixPhone.watchkitapp" project.yml; then
            print_check 0 "Watch bundle ID configured"
        else
            print_check 1 "Watch bundle ID not found"
        fi
        
        # Check code signing
        if grep -q "CODE_SIGN_STYLE: Automatic" project.yml; then
            print_check 0 "Code signing style set to Automatic"
        else
            print_check 1 "Code signing style not set"
        fi
        
        # Check team
        if grep -q "DEVELOPMENT_TEAM: \"AWJBX83Y4X\"" project.yml; then
            print_check 0 "Development team configured"
        else
            print_check 1 "Development team not configured"
        fi
    else
        print_check 1 "project.yml not found"
    fi
}

# Check Info.plist
check_infoplist() {
    print_header "Watch Info.plist Configuration"
    
    if [ -f "KinetixWatch/Info.plist" ]; then
        print_check 0 "Watch Info.plist exists"
        
        # Check WKCompanionAppBundleIdentifier
        if grep -q "WKCompanionAppBundleIdentifier" KinetixWatch/Info.plist; then
            COMPANION_ID=$(grep -A 1 "WKCompanionAppBundleIdentifier" KinetixWatch/Info.plist | tail -n 1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/')
            if [ "$COMPANION_ID" == "com.patrickduchesneau.KinetixPhone" ]; then
                print_check 0 "WKCompanionAppBundleIdentifier correct: $COMPANION_ID"
            else
                print_check 1 "WKCompanionAppBundleIdentifier incorrect: $COMPANION_ID"
            fi
        else
            print_check 1 "WKCompanionAppBundleIdentifier not found"
        fi
        
        # Check WKApplication
        if grep -q "<key>WKApplication</key>" KinetixWatch/Info.plist; then
            print_check 0 "WKApplication key exists"
        else
            print_check 1 "WKApplication key not found"
        fi
    else
        print_check 1 "Watch Info.plist not found"
    fi
}

# Check devices
check_devices() {
    print_header "Connected Devices"
    
    if command -v xcrun &> /dev/null; then
        DEVICES=$(xcrun xctrace list devices 2>/dev/null | grep -E "(iPhone|Watch|iPad)" | wc -l | tr -d ' ')
        if [ "$DEVICES" -gt 0 ]; then
            print_check 0 "Devices connected: $DEVICES"
            echo ""
            echo "Connected devices:"
            xcrun xctrace list devices 2>/dev/null | grep -E "(iPhone|Watch|iPad)" | sed 's/^/  /'
        else
            print_check 1 "No devices connected"
        fi
    else
        print_check 1 "xcrun not found"
    fi
}

# Check build products
check_builds() {
    print_header "Build Products"
    
    WATCH_APP=$(find ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-watchos -name "KinetixWatch.app" 2>/dev/null | head -n 1)
    PHONE_APP=$(find ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-iphoneos -name "KinetixPhone.app" 2>/dev/null | head -n 1)
    
    if [ -n "$WATCH_APP" ]; then
        print_check 0 "Watch app built: $(basename $(dirname $(dirname $WATCH_APP)))"
    else
        print_check 1 "Watch app not built"
    fi
    
    if [ -n "$PHONE_APP" ]; then
        print_check 0 "iPhone app built: $(basename $(dirname $(dirname $PHONE_APP)))"
    else
        print_check 1 "iPhone app not built"
    fi
}

# Check code signing
check_signing() {
    print_header "Code Signing"
    
    WATCH_APP=$(find ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-watchos -name "KinetixWatch.app" 2>/dev/null | head -n 1)
    PHONE_APP=$(find ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-iphoneos -name "KinetixPhone.app" 2>/dev/null | head -n 1)
    
    if [ -n "$PHONE_APP" ]; then
        if codesign -dvvv "$PHONE_APP" &>/dev/null; then
            print_check 0 "iPhone app is signed"
        else
            print_check 1 "iPhone app signing failed"
        fi
    fi
    
    if [ -n "$WATCH_APP" ]; then
        if codesign -dvvv "$WATCH_APP" &>/dev/null; then
            print_check 0 "Watch app is signed"
        else
            print_check 1 "Watch app signing failed"
        fi
    fi
}

# Main
main() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Watch Setup Verification${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    check_xcode
    check_project
    check_infoplist
    check_devices
    check_builds
    check_signing
    
    print_header "Summary"
    echo "Run this script after making changes to verify your setup."
    echo "For installation help, see WATCH_INSTALL_FIX.md"
    echo ""
}

main "$@"






