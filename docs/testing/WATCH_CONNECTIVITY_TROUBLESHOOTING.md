# WatchConnectivity troubleshooting (Kinetix)

**Related:** KX-WATCH-024 — [`docs/kinetix/KX-WATCH-024-watch-connectivity-contract.md`](../kinetix/KX-WATCH-024-watch-connectivity-contract.md)

## Paired but not reachable

**Symptoms:** iPhone Settings → Diagnostics shows "Paired (Not Reachable)"; ping fails with a reachability hint.

**Typical causes**

- iPhone locked or app in deep background; WatchConnectivity interactive messages need the **phone app reachable** from the watch's perspective and often both sides awake.
- Watch app not in foreground when testing ping from phone.
- Bluetooth/Wi-Fi path temporarily unavailable (rare); toggle Airplane on/off on Watch.

**What still works:** `updateApplicationContext` can deliver when interactive channel is down — templates, weight snapshot, `isRunning` flag may still update on next wake.

## Watch app installed but never launched

**Symptoms:** "Watch App Not Installed" or no context updates.

**Checks**

- Install from iPhone Watch app or Xcode; open **Kinetix** on the Watch once.
- Confirm bundle hierarchy: iPhone `com.patrickduchesneau.KinetixPhone`, Watch `com.patrickduchesneau.KinetixPhone.watchkitapp`, and `WKCompanionAppBundleIdentifier` in Watch `Info.plist`.

## Simulator limitations

- **iOS Simulator / watchOS Simulator:** `WCSession` is **not supported** the same way as hardware; ping/pong and reachability UI are not valid proof of production behavior.
- Use **physical iPhone + Apple Watch** for KX-WATCH-024 acceptance testing.

## Physical Watch requirements

- Paired Apple Watch with Kinetix Watch target installed.
- Same Apple ID / pair relationship as normal Watch apps.
- Both apps built with matching team signing if testing ad hoc.

## Xcode destination issues

**Symptoms:** Watch app missing from Run destination; install fails.

**Checks**

- Select the **Watch** scheme or run the iPhone scheme that **embeds** the Watch app (`KinetixPhone` embeds `KinetixWatch` in `watchos/project.yml`).
- After adding Swift files under `watchos/KinetixWatch/`, run **`xcodegen generate`** in `watchos/` so the `.xcodeproj` picks up new sources.
- Clean build folder if Swift types appear missing after codegen.

## BLOCKED_ON_PHYSICAL_WATCH

Any claim that ping/pong or reachability **works end-to-end** without a physical pair should be marked **BLOCKED_ON_PHYSICAL_WATCH** until tested on real hardware.
