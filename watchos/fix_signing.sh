#!/bin/bash
# Script to help fix Xcode signing issues

echo "Cleaning Xcode caches..."
rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*

echo ""
echo "✅ Cleaned Xcode caches"
echo ""
echo "Next steps in Xcode:"
echo "1. Close Xcode completely"
echo "2. Reopen the project"
echo "3. In Signing & Capabilities:"
echo "   - Try changing target to 'Apple Watch Simulator' first"
echo "   - Build for simulator (⌘B)"
echo "   - Then switch back to your physical watch"
echo "   - Click 'Try Again'"
