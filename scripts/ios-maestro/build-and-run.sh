#!/usr/bin/env bash
# Build KinetixPhone for an iOS Simulator, install it, and run the Maestro
# crawl flows. Captures screenshots, JUnit report, and simulator.log as
# artifacts under reports/ and .maestro/screenshots/.
#
# Designed to run on macOS (CI: macos-14 / locally on a Mac dev box).
# Will fail fast on Linux/Windows because xcodebuild / xcrun are macOS-only.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." >/dev/null 2>&1 && pwd)"
cd "${REPO_ROOT}"

# --------------------------------------------------------------------------
# Inputs (env-overridable)
# --------------------------------------------------------------------------
SIM_DEVICE="${SIM_DEVICE:-iPhone 15}"
SIM_RUNTIME_HINT="${SIM_RUNTIME_HINT:-iOS}"           # match by family; pick newest
SIM_NAME="${SIM_NAME:-Kinetix Crawl Sim}"
APP_BUNDLE_ID="${APP_BUNDLE_ID:-com.patrickduchesneau.KinetixPhone}"
SCHEME="${SCHEME:-KinetixPhone}"
CONFIG="${CONFIG:-Debug}"
DERIVED_DATA="${DERIVED_DATA:-${REPO_ROOT}/build/DerivedData}"
REPORTS_DIR="${REPORTS_DIR:-${REPO_ROOT}/reports/maestro}"
SCREENSHOT_DIR="${SCREENSHOT_DIR:-${REPO_ROOT}/.maestro/screenshots}"
SIM_LOG="${SIM_LOG:-${REPO_ROOT}/reports/simulator.log}"
RUN_EXPLORATION="${RUN_EXPLORATION:-0}"

# --------------------------------------------------------------------------
# Sanity
# --------------------------------------------------------------------------
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: this script must run on macOS (got $(uname -s))." >&2
  exit 2
fi

for tool in xcodebuild xcrun xcodegen maestro plutil; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "ERROR: required tool '${tool}' not found on PATH." >&2
    exit 3
  fi
done

mkdir -p "${REPORTS_DIR}" "${SCREENSHOT_DIR}" "$(dirname "${SIM_LOG}")"

# --------------------------------------------------------------------------
# Generate Xcode project
# --------------------------------------------------------------------------
echo "==> xcodegen (watchos/project.yml)"
( cd watchos && xcodegen generate )

# --------------------------------------------------------------------------
# Pick the newest installed iOS runtime that the Xcode in PATH supports
# --------------------------------------------------------------------------
echo "==> Choosing iOS Simulator runtime"
RUNTIME_ID="$(
  xcrun simctl list runtimes --json \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
runtimes = [r for r in data['runtimes']
            if r.get('isAvailable') and 'iOS' in r.get('name', '')]
if not runtimes:
    sys.exit('No available iOS runtimes installed.')
runtimes.sort(key=lambda r: tuple(int(p) for p in r['version'].split('.')))
print(runtimes[-1]['identifier'])
"
)"
echo "    runtime: ${RUNTIME_ID}"

# --------------------------------------------------------------------------
# Create / reuse a dedicated simulator device
# --------------------------------------------------------------------------
echo "==> Preparing simulator: ${SIM_NAME} (${SIM_DEVICE})"
EXISTING_UDID="$(xcrun simctl list devices --json \
  | python3 -c "
import json, sys
target = '${SIM_NAME}'
data = json.load(sys.stdin)
for runtime, devices in data['devices'].items():
    for d in devices:
        if d.get('name') == target and d.get('isAvailable', True):
            print(d['udid']); sys.exit(0)
")"

if [[ -z "${EXISTING_UDID}" ]]; then
  DEVICE_TYPE_ID="$(xcrun simctl list devicetypes --json \
    | python3 -c "
import json, sys
target = '${SIM_DEVICE}'
data = json.load(sys.stdin)
matches = [d for d in data['devicetypes'] if d.get('name') == target]
if not matches:
    sys.exit(f\"No device type named '{target}'.\")
print(matches[0]['identifier'])
")"
  UDID="$(xcrun simctl create "${SIM_NAME}" "${DEVICE_TYPE_ID}" "${RUNTIME_ID}")"
  echo "    created new simulator udid: ${UDID}"
else
  UDID="${EXISTING_UDID}"
  echo "    reusing existing simulator udid: ${UDID}"
fi

xcrun simctl shutdown "${UDID}" 2>/dev/null || true
xcrun simctl erase "${UDID}"
xcrun simctl boot "${UDID}"
xcrun simctl bootstatus "${UDID}" -b

# --------------------------------------------------------------------------
# Build the app for the simulator
# --------------------------------------------------------------------------
echo "==> xcodebuild (${SCHEME} for ${SIM_DEVICE})"
xcodebuild \
  -project watchos/KinetixWatch.xcodeproj \
  -scheme "${SCHEME}" \
  -configuration "${CONFIG}" \
  -destination "platform=iOS Simulator,id=${UDID}" \
  -derivedDataPath "${DERIVED_DATA}" \
  CODE_SIGNING_ALLOWED=NO \
  build \
  | tee "${REPORTS_DIR}/xcodebuild.log" \
  | xcbeautify --quieter 2>/dev/null || true

APP_PATH="$(/usr/bin/find "${DERIVED_DATA}" -type d -name 'KinetixPhone.app' \
  -path '*Debug-iphonesimulator*' -print -quit)"
if [[ -z "${APP_PATH}" || ! -d "${APP_PATH}" ]]; then
  echo "ERROR: built KinetixPhone.app not found under ${DERIVED_DATA}" >&2
  exit 4
fi
echo "    app: ${APP_PATH}"

# --------------------------------------------------------------------------
# Install the app
# --------------------------------------------------------------------------
echo "==> Installing app on simulator"
xcrun simctl install "${UDID}" "${APP_PATH}"

# --------------------------------------------------------------------------
# Start capturing simulator log in the background
# --------------------------------------------------------------------------
echo "==> Starting simulator log capture -> ${SIM_LOG}"
: > "${SIM_LOG}"
xcrun simctl spawn "${UDID}" log stream \
  --level debug \
  --style syslog \
  --predicate 'subsystem CONTAINS "com.patrickduchesneau" OR processImagePath CONTAINS "KinetixPhone"' \
  > "${SIM_LOG}" 2>&1 &
LOG_PID=$!
trap 'kill "${LOG_PID}" 2>/dev/null || true' EXIT

# --------------------------------------------------------------------------
# Run Maestro flows
# --------------------------------------------------------------------------
echo "==> maestro test .maestro/flows"
set +e
MAESTRO_OUTPUT_DIR="${REPORTS_DIR}" \
maestro --device "${UDID}" test \
  .maestro/flows \
  --format junit \
  --output "${REPORTS_DIR}/junit.xml" \
  --debug-output "${REPORTS_DIR}/debug"
MAESTRO_EXIT=$?
set -e
echo "    maestro exit code: ${MAESTRO_EXIT}"

# Move any screenshots that landed in the working dir into SCREENSHOT_DIR
# (Maestro names them after the takeScreenshot label, in CWD by default.)
shopt -s nullglob
for png in "${REPO_ROOT}"/*.png; do
  mv "${png}" "${SCREENSHOT_DIR}/"
done
shopt -u nullglob

# --------------------------------------------------------------------------
# Optional: exploratory crawl (only on demand; doesn't fail the job)
# --------------------------------------------------------------------------
if [[ "${RUN_EXPLORATION}" == "1" ]]; then
  echo "==> maestro test .maestro/exploration (best-effort)"
  set +e
  maestro --device "${UDID}" test \
    .maestro/exploration \
    --debug-output "${REPORTS_DIR}/debug-exploration" \
    || echo "WARN: exploration crawl reported failures (non-blocking)."
  set -e
  shopt -s nullglob
  for png in "${REPO_ROOT}"/*.png; do
    mv "${png}" "${SCREENSHOT_DIR}/"
  done
  shopt -u nullglob
fi

# --------------------------------------------------------------------------
# Stop log capture, shutdown simulator
# --------------------------------------------------------------------------
kill "${LOG_PID}" 2>/dev/null || true
wait "${LOG_PID}" 2>/dev/null || true
trap - EXIT

xcrun simctl shutdown "${UDID}" || true

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------
echo "==> Done."
echo "    junit:       ${REPORTS_DIR}/junit.xml"
echo "    screenshots: ${SCREENSHOT_DIR}"
echo "    sim log:     ${SIM_LOG}"
echo "    debug:       ${REPORTS_DIR}/debug"

exit "${MAESTRO_EXIT}"
