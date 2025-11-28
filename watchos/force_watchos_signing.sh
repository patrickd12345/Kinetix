#!/bin/bash
# Force watchOS signing by cleaning everything and using a fresh bundle ID

echo "This will change the bundle ID to force a fresh watchOS profile..."
echo ""

# Generate a unique bundle ID
NEW_BUNDLE_ID="com.patrickduchesneau.KinetixWatch.$(date +%s)"

echo "New bundle ID: $NEW_BUNDLE_ID"
echo ""
echo "Updating project.yml..."

# Update project.yml
sed -i '' "s/PRODUCT_BUNDLE_IDENTIFIER: com.patrickduchesneau.KinetixWatch/PRODUCT_BUNDLE_IDENTIFIER: $NEW_BUNDLE_ID/" project.yml

echo "✅ Updated. Now regenerating project..."
xcodegen generate

echo ""
echo "✅ Done! Close and reopen Xcode, then try signing again."
echo "The new bundle ID should force Xcode to create a fresh watchOS profile."
