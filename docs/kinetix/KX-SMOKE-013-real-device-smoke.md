# KX-SMOKE-013 — Real iPhone + Apple Watch Smoke

## 1. Purpose

Verify KinetixPhone and KinetixWatch on physical hardware after native KPS, Coach AI, FoundationModels, Watch parity, and Native CI changes.

**Native CI note:** Watch compile in CI uses `xcodebuild -target KinetixWatch -sdk watchsimulator` (no scheme + Watch sim destination). The helper `watchos/scripts/resolve-watch-sim-udid.sh` is kept in-repo for optional future Watch UI tests when the `KinetixWatch` scheme exposes a concrete watchOS Simulator destination.

## 2. Prerequisites

- Mac unlocked
- Xcode installed
- iPhone trusted, unlocked, and connected
- Apple Watch paired to the iPhone
- Correct Apple Developer account selected in Xcode
- HealthKit capability/provisioning available if required
- Apple Intelligence enabled on iPhone if available
- If Xcode transport error occurs, run:

  ```bash
  sudo killall -9 usbmuxd
  ```

## 3. Build Targets

| Item | Value |
|------|--------|
| Project path | `watchos/KinetixWatch.xcodeproj` |
| iPhone scheme | `KinetixPhone` |
| Watch target/scheme | `KinetixWatch` |
| Known simulator (local QA reference) | iPhone 17 Pro, iOS 26.4 |

## 4. iPhone Physical Smoke

Checklist:

- [ ] Select real iPhone destination.
- [ ] Build **KinetixPhone**.
- [ ] Launch app.
- [ ] Verify Home loads.
- [ ] Verify KPS Hero appears.
- [ ] Verify no KPS display above 100.
- [ ] Open Coach.
- [ ] Send “Hi”.
- [ ] **Expected:**
  - If FoundationModels / SystemLanguageModel is available: short practical coach response.
  - Else: **Coach AI is not available on this device yet.**
- [ ] Confirm no Gemini/API-key copy.
- [ ] Open Settings.
- [ ] Confirm no normal user-facing Gemini setup requirement.
- [ ] Start Run flow opens.
- [ ] Permission prompts are understandable.
- [ ] Stop/save/cancel controls are understandable.

## 5. Apple Watch Physical Smoke

Checklist:

- [ ] Select paired Apple Watch destination.
- [ ] Build/install Watch app.
- [ ] Launch Watch app.
- [ ] Verify main screen loads.
- [ ] Verify History KPS values display capped at 100.
- [ ] Verify Run detail KPS header displays capped at 100.
- [ ] Verify Coach/chat fallback copy is watch-specific: **Open Kinetix on iPhone for coach chat.**
- [ ] Confirm no Gemini/API-key copy.
- [ ] Confirm no crash on launch.
- [ ] Confirm HealthKit/signing prompts are expected.

## 6. Troubleshooting

- **Transport error:** `sudo killall -9 usbmuxd` → reconnect phone → unlock phone → trust computer → retry.
- **Keychain prompt:** enter Mac login password → choose Always Allow.
- **Signing/profile failure:** verify Team in Xcode → verify bundle identifiers → verify provisioning/capabilities.
- **Watch install failure:** keep iPhone unlocked → keep Watch unlocked/on wrist → verify Watch is paired → retry after reconnect.
- **DerivedData / build database locked:** close duplicate Xcode/Cursor builds → Clean Build Folder → remove only Kinetix DerivedData if needed.

## 7. Smoke Result Table

| Area | Pass/Fail/Blocked | Notes |
|------|-------------------|--------|
| iPhone build | | |
| iPhone launch | | |
| Home KPS Hero | | |
| KPS cap | | |
| Coach response | | |
| Gemini/API-key copy absent | | |
| Settings | | |
| Start Run | | |
| Watch build | | |
| Watch launch | | |
| Watch KPS cap | | |
| Watch coach fallback | | |
| HealthKit/signing | | |
| Transport stability | | |

## 8. Final Verdict

*(Choose one: **PASS** · **PASS WITH CAVEATS** · **BLOCKED ON SIGNING** · **BLOCKED ON DEVICE TRANSPORT** · **BLOCKED ON HEALTHKIT/CAPABILITIES** · **FAIL**)*

**Verdict:** _TBD_

**Date / environment:** _TBD_

---

## KX-SMOKE-014 Physical Apple Watch Result

**Recorded:** 2026-04-29 (local) — automation + CLI inventory (GUI install/launch not executed in this session).

| Field | Value |
|--------|--------|
| **Mac / Xcode** | macOS (Darwin 25.x); **Xcode 26.4** (Build **17E192**) |
| **iPhone (CLI)** | **iPhone Patrick** — `platform:iOS`, id `00008150-001670AC2691401C` (listed under **KinetixPhone** scheme destinations). |
| **iOS version (friendly)** | Matches prior smoke: **26.5** class devices (exact build string not captured in `showdestinations`). |
| **Apple Watch model / watchOS** | **Not visible** to CLI in this run (`xcodebuild -scheme KinetixWatch -showdestinations` lists only **Any watchOS Device** placeholder). |
| **Selected scheme (intended)** | **KinetixWatch** |
| **Selected destination (intended)** | Paired physical Apple Watch via Xcode UI (see blocker below). |
| **Project opened** | `open watchos/KinetixWatch.xcodeproj` executed to support manual Xcode steps. |

### CLI destination inventory

- **`xcodebuild -scheme KinetixWatch -showdestinations`:** only  
  `{ platform:watchOS, name:Any watchOS Device }` — **no concrete physical Watch UDID** for non-interactive `xcodebuild`.
- **`xcrun devicectl list devices`:** **iPhone Patrick** (iPhone 17 Pro Max) **connected**; other iPhones **unavailable**; **no separate Watch row** in the table output. First line of stderr: provisioning/CoreDevice **Code=1002** “No provider was found.” (informational noise; iPhone still listed connected).
- **GUI smoke (Steps 3–4):** not performed by automation — requires **Product → Run** on a **paired Watch** destination in Xcode.

### Build / install / launch (physical Watch)

| Step | Result |
|------|--------|
| **Build** | Not run for physical Watch (no safe `xcodebuild` destination id). |
| **Install** | Not observed (GUI not driven). |
| **Launch** | Not observed (GUI not driven). |

### Smoke checklist (Watch — on-device)

| Check | Result |
|--------|--------|
| App launch / no crash | **Not run** |
| Main screen | **Not run** |
| History KPS ≤ 100 | **Not run** |
| Run detail KPS ≤ 100 | **Not run** |
| Coach fallback “Open Kinetix on iPhone for coach chat.” / no Gemini copy | **Not run** |
| Navigation stability | **Not run** |

### First blocker

**BLOCKED ON WATCH DESTINATION (for CLI):** `KinetixWatch` scheme does not expose a **concrete paired Apple Watch** to `xcodebuild`; physical Watch install/launch must be completed in **Xcode** with the paired Watch selected (Steps 2–4 in task). Do not guess a destination id.

### Troubleshooting applied

- **`sudo killall -9 usbmuxd`:** **not run** — no transport error observed during CLI checks.

### KX-SMOKE-014 Final verdict

**BLOCKED ON WATCH DESTINATION** — automated session could not attach a physical Watch destination via CLI; **manual Xcode GUI smoke** (scheme **KinetixWatch**, destination **paired Watch**, Clean → Build → Run) remains **required** to complete KX-SMOKE-014 checklist.
