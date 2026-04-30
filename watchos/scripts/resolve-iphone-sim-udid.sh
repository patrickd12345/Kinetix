#!/usr/bin/env bash
# Prints UDID of the first available iPhone simulator (concrete device required for xcodebuild test).
set -euo pipefail
xcrun simctl list devices available -j | python3 -c '
import json, sys
data = json.load(sys.stdin)
for _runtime, devices in sorted(data.get("devices", {}).items()):
    for d in devices:
        if not d.get("isAvailable"):
            continue
        name = d.get("name", "")
        if name.startswith("iPhone") and "iPad" not in name:
            print(d["udid"])
            sys.exit(0)
sys.stderr.write("resolve-iphone-sim-udid: no available iPhone simulator\n")
sys.exit(1)
'
