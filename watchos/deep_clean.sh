#!/bin/bash
echo "Performing deep clean..."
rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*
rm -rf KinetixWatch.xcodeproj
xcodegen generate
echo "✅ Project regenerated (type: application + XCWatchOSCodeSignContext). Please open KinetixWatch.xcodeproj"
