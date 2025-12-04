#!/bin/bash

echo "🔧 Apple Watch Connection Fix Script"
echo "======================================"
echo ""

# Step 1: Clean Xcode caches
echo "1️⃣ Cleaning Xcode caches..."
rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*
echo "   ✅ Cleaned"
echo ""

# Step 2: Check if devices are connected
echo "2️⃣ Checking device connections..."
echo "   Run this in Xcode: Window → Devices and Simulators"
echo "   Verify both iPhone and Watch are listed and trusted"
echo ""

# Step 3: Instructions
echo "3️⃣ Next Steps (in order):"
echo ""
echo "   A. In Xcode:"
echo "      - Product → Clean Build Folder (Shift+Cmd+K)"
echo "      - Close Xcode completely (Cmd+Q)"
echo ""
echo "   B. On your iPhone:"
echo "      - Open the Watch app"
echo "      - Scroll to find 'Kinetix'"
echo "      - If it shows 'Not Installed', tap to install"
echo "      - Wait for installation to complete"
echo ""
echo "   C. On your Apple Watch:"
echo "      - Make sure it's unlocked (enter passcode if needed)"
echo "      - Keep it on your wrist or charger"
echo ""
echo "   D. Back in Xcode:"
echo "      - Reopen the project"
echo "      - Select KinetixPhone scheme"
echo "      - Build & Run on iPhone (Cmd+R)"
echo "      - Wait for it to launch successfully"
echo ""
echo "   E. Then:"
echo "      - Select KinetixWatch scheme"
echo "      - Choose your Watch as destination"
echo "      - Build & Run (Cmd+R)"
echo ""
echo "4️⃣ If still failing, try:"
echo "   - Window → Devices and Simulators"
echo "   - Right-click your Watch → 'Unpair'"
echo "   - Re-pair the Watch"
echo "   - Rebuild"
echo ""

echo "✅ Script complete. Follow the steps above."



