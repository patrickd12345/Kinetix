#!/usr/bin/env bash
# Prints UDID of the first available Apple Watch simulator (concrete device required for xcodebuild).
# Selection is by watchOS runtime only — no hardcoded model name.
set -euo pipefail
xcrun simctl list devices available -j | python3 -c '
import json, sys
data = json.load(sys.stdin)
for runtime, devices in sorted(data.get("devices", {}).items()):
    if "watchOS" not in runtime:
        continue
    for d in devices:
        if not d.get("isAvailable"):
            continue
        print(d["udid"])
        sys.exit(0)
sys.stderr.write("resolve-watch-sim-udid: no available Apple Watch simulator\n")
sys.exit(1)
'
