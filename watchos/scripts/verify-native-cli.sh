#!/usr/bin/env bash
# Local parity with Native CI + Watch compile gate. Run from repo root: bash watchos/scripts/verify-native-cli.sh
# Or: cd watchos && bash scripts/verify-native-cli.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DERIVED_DATA="${DERIVED_DATA:-/tmp/kinetix-verify-native-dd}"
export DERIVED_DATA

echo "== XcodeGen =="
xcodegen generate

echo "== KinetixWatch (watchsimulator, target) =="
xcodebuild -project KinetixWatch.xcodeproj \
  -target KinetixWatch \
  -sdk watchsimulator \
  CODE_SIGNING_ALLOWED=NO \
  build -quiet

echo "== KinetixPhone build-for-testing (iOS Simulator) =="
rm -rf "$DERIVED_DATA"
xcodebuild -project KinetixWatch.xcodeproj \
  -scheme KinetixPhone \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  build-for-testing -quiet

UDID="$(bash scripts/resolve-iphone-sim-udid.sh)"
echo "== KinetixPhoneTests (UDID $UDID) =="
xcodebuild -project KinetixWatch.xcodeproj \
  -scheme KinetixPhone \
  -destination "platform=iOS Simulator,id=${UDID}" \
  -derivedDataPath "$DERIVED_DATA" \
  -only-testing:KinetixPhoneTests \
  test-without-building

echo "== verify-native-cli: OK =="
