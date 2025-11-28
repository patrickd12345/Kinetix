#!/bin/bash
# Clean up cached provisioning profiles to force regeneration
echo "Cleaning cached provisioning profiles..."
rm -f ~/Library/MobileDevice/Provisioning\ Profiles/*
echo "Cleaning DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*
echo "✅ Cleanup complete. Please restart Xcode."
