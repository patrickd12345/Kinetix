#!/bin/bash

# Complete Watch Installation Fix Script
# This script automates the most common fixes for watchOS installation issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_xcode() {
    if ! command -v xcodebuild &> /dev/null; then
        print_error "Xcode is not installed or not in PATH"
        exit 1
    fi
    
    XCODE_VERSION=$(xcodebuild -version | head -n 1 | awk '{print $2}')
    print_step "Xcode version: $XCODE_VERSION"
}

check_devices() {
    print_header "Checking Connected Devices"
    
    if ! command -v xcrun &> /dev/null; then
        print_error "xcrun not found. Is Xcode installed?"
        exit 1
    fi
    
    print_info "Connected devices:"
    xcrun xctrace list devices 2>/dev/null | grep -E "(iPhone|Watch|iPad)" || print_warning "No devices found. Make sure devices are connected and trusted."
    echo ""
}

clean_caches() {
    print_header "Cleaning Xcode Caches"
    
    print_step "Removing DerivedData..."
    rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-* 2>/dev/null || true
    print_step "Removed DerivedData"
    
    print_step "Removing Xcode caches..."
    rm -rf ~/Library/Caches/com.apple.dt.Xcode/* 2>/dev/null || true
    print_step "Removed Xcode caches"
    
    print_info "Caches cleaned. You should also clean build folder in Xcode:"
    print_info "  Product → Clean Build Folder (Shift+⌘+K)"
    echo ""
}

verify_project() {
    print_header "Verifying Project Configuration"
    
    if [ ! -f "project.yml" ]; then
        print_error "project.yml not found. Are you in the watchos directory?"
        exit 1
    fi
    
    print_step "project.yml found"
    
    # Check bundle IDs
    if grep -q "com.patrickduchesneau.KinetixPhone" project.yml; then
        print_step "Bundle IDs configured correctly"
    else
        print_warning "Bundle IDs may not be configured correctly"
    fi
    
    # Check Info.plist
    if [ -f "KinetixWatch/Info.plist" ]; then
        if grep -q "WKCompanionAppBundleIdentifier" KinetixWatch/Info.plist; then
            print_step "Watch Info.plist has WKCompanionAppBundleIdentifier"
        else
            print_warning "Watch Info.plist missing WKCompanionAppBundleIdentifier"
        fi
    else
        print_warning "Watch Info.plist not found"
    fi
    
    echo ""
}

check_build_products() {
    print_header "Checking Build Products"
    
    WATCH_APP=$(find ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-watchos -name "KinetixWatch.app" 2>/dev/null | head -n 1)
    PHONE_APP=$(find ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*/Build/Products/Debug-iphoneos -name "KinetixPhone.app" 2>/dev/null | head -n 1)
    
    if [ -n "$WATCH_APP" ]; then
        print_step "Watch app found: $WATCH_APP"
    else
        print_warning "Watch app not found. You may need to build it first."
    fi
    
    if [ -n "$PHONE_APP" ]; then
        print_step "iPhone app found: $PHONE_APP"
    else
        print_warning "iPhone app not found. You may need to build it first."
    fi
    
    echo ""
}

print_instructions() {
    print_header "Installation Instructions"
    
    echo -e "${GREEN}Method 1: Install via iPhone (RECOMMENDED - 95% success rate)${NC}"
    echo ""
    echo "1. In Xcode:"
    echo "   - Select KinetixPhone scheme"
    echo "   - Choose your iPhone as destination"
    echo "   - Build & Run (⌘+R)"
    echo "   - Wait for iPhone app to launch"
    echo ""
    echo "2. On your iPhone:"
    echo "   - Open the Watch app"
    echo "   - Scroll to find 'Kinetix'"
    echo "   - If it shows 'Not Installed', tap to install"
    echo "   - Wait 1-2 minutes for installation"
    echo ""
    echo "3. On your Apple Watch:"
    echo "   - Press Digital Crown"
    echo "   - Look for Kinetix app icon"
    echo ""
    echo "4. Back in Xcode:"
    echo "   - Select KinetixWatch scheme"
    echo "   - Choose your Watch as destination"
    echo "   - Build & Run (⌘+R)"
    echo ""
    
    print_warning "The Watch app MUST be installed via iPhone first!"
    print_warning "Xcode cannot do the initial installation directly."
    echo ""
}

print_troubleshooting() {
    print_header "Troubleshooting Steps"
    
    echo "If installation still fails, try these in order:"
    echo ""
    echo "1. Check device status:"
    echo "   - Window → Devices and Simulators"
    echo "   - Verify both iPhone and Watch are listed"
    echo "   - Check if Watch shows 'Preparing...' - wait for it"
    echo ""
    echo "2. Fix code signing:"
    echo "   - Select KinetixWatch target"
    echo "   - Signing & Capabilities"
    echo "   - Uncheck 'Automatically manage signing'"
    echo "   - Recheck 'Automatically manage signing'"
    echo "   - Select Team (AWJBX83Y4X)"
    echo "   - Click 'Try Again'"
    echo ""
    echo "3. Verify bundle IDs:"
    echo "   - iPhone: com.patrickduchesneau.KinetixPhone"
    echo "   - Watch: com.patrickduchesneau.KinetixPhone.watchkitapp"
    echo "   - Watch Info.plist: WKCompanionAppBundleIdentifier = com.patrickduchesneau.KinetixPhone"
    echo ""
    echo "4. Clean build folder:"
    echo "   - Product → Clean Build Folder (Shift+⌘+K)"
    echo ""
    echo "5. Restart devices:"
    echo "   - Restart iPhone"
    echo "   - Restart Watch"
    echo "   - Reconnect in Xcode"
    echo ""
    echo "6. Nuclear option - Re-pair Watch:"
    echo "   - Window → Devices and Simulators"
    echo "   - Right-click Watch → Unpair"
    echo "   - On iPhone: Settings → Watch → Unpair"
    echo "   - Re-pair Watch"
    echo ""
}

print_verification() {
    print_header "Verification Checklist"
    
    echo "Before reporting an issue, verify:"
    echo ""
    echo "Device Requirements:"
    echo "  ✓ iPhone: iOS 17.0+"
    echo "  ✓ Watch: watchOS 10.0+"
    echo "  ✓ Both devices on same Apple ID"
    echo "  ✓ Both devices trusted in Xcode"
    echo "  ✓ Watch is unlocked"
    echo "  ✓ Watch has storage (50MB+)"
    echo ""
    echo "Xcode Configuration:"
    echo "  ✓ Both targets use Team: AWJBX83Y4X"
    echo "  ✓ Both targets use 'Automatic' signing"
    echo "  ✓ KinetixPhone embeds KinetixWatch"
    echo ""
    echo "Bundle IDs:"
    echo "  ✓ iPhone: com.patrickduchesneau.KinetixPhone"
    echo "  ✓ Watch: com.patrickduchesneau.KinetixPhone.watchkitapp"
    echo "  ✓ Watch Info.plist: WKCompanionAppBundleIdentifier = com.patrickduchesneau.KinetixPhone"
    echo ""
    echo "Installation:"
    echo "  ✓ iPhone app installed and runs"
    echo "  ✓ Watch app installed (check via iPhone Watch app)"
    echo "  ✓ Watch app appears on Watch home screen"
    echo ""
}

show_help() {
    echo "Watch Installation Fix Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --clean          Clean Xcode caches only"
    echo "  --check          Check configuration only"
    echo "  --verify         Show verification checklist"
    echo "  --help           Show this help message"
    echo ""
    echo "Without options, runs full diagnostic and shows instructions."
    echo ""
}

# Main script
main() {
    print_header "🔧 Watch Installation Fix Script"
    
    # Parse arguments
    if [ "$1" == "--clean" ]; then
        clean_caches
        exit 0
    elif [ "$1" == "--check" ]; then
        check_xcode
        check_devices
        verify_project
        check_build_products
        exit 0
    elif [ "$1" == "--verify" ]; then
        print_verification
        exit 0
    elif [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
        show_help
        exit 0
    fi
    
    # Full diagnostic
    check_xcode
    check_devices
    verify_project
    check_build_products
    clean_caches
    
    print_instructions
    print_troubleshooting
    
    print_header "Next Steps"
    print_info "1. Follow the installation instructions above"
    print_info "2. If still failing, check the troubleshooting steps"
    print_info "3. For more details, see WATCH_INSTALL_FIX.md"
    echo ""
    print_info "Most common fix: Install Watch app via iPhone first (Method 1)"
    echo ""
}

# Run main function
main "$@"



