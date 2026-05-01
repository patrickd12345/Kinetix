# KX-WATCH-024 — Watch / iPhone connectivity contract

**Task ID:** KX-WATCH-024-CONNECTIVITY-USE-CASE  
**Last updated:** 2026-05-01

## Product split (intended)

| Surface | Role |
|--------|------|
| **Apple Watch** | **Live run cockpit only** — start/stop/pause run, live metrics, form feedback during activity, minimal settings needed for that session. Deep coaching chat, planning, history analysis, integrations, and account flows stay off-watch. |
| **iPhone** | **Planning, coaching, history, settings, analysis** — templates, battery profiles, Strava/Withings/cloud, conversational coach, lab reports, diagnostics. |

Existing code still ships extra Watch tabs (history, manual, etc.); this document is the **target contract**. New work should not expand Watch scope beyond the cockpit until explicitly replanned.

## Technical contract (WatchConnectivity)

### Session lifecycle

| Step | iPhone (`ConnectivityManager`) | Watch (`LocationManager`) |
|------|-------------------------------|----------------------------|
| Delegate | `WCSession.default.delegate = self` in `setupSession()` | `WCSession.default.delegate = self` in `setupConnectivity()` |
| Activate | `session.activate()` | `session.activate()` |
| Reactivation | `sessionDidDeactivate` calls `activate()` again | Same |
| Reachability | `sessionReachabilityDidChange` → `updateConnectionStatus` | `sessionReachabilityDidChange` → `refreshPhoneLinkStatus` |

### Transport

- **Interactive:** `sendMessage(_:replyHandler:errorHandler:)` when `isReachable` is true (foreground-ish path).
- **Deferred:** `updateApplicationContext` for durable payloads (activities, battery profiles, run state flags, Withings weight snapshot).

### Diagnostic ping / pong (KX-WATCH-024)

Stable keys live in `KinetixWatchConnectivityDiagnostics` (`ios/KinetixPhone/Services/KinetixWatchConnectivityDiagnostics.swift`, also compiled into the Watch target).

| Direction | Payload |
|-----------|---------|
| iPhone → Watch | `[messageKey: "ping"]` where `messageKey` is `kx_diag_v1` |
| Watch → iPhone | Reply via `replyHandler`: `[messageKey: "pong", pongTimestampKey: <unix time>]` |

**UI**

- iPhone: Settings → Diagnostics — status line, **Ping Watch (diagnostic)**, last pong time / error.
- Watch: Settings → **PHONE LINK** — reachability line driven by `isReachable` + activation / companion install.

### Simulator vs device

- **iOS Simulator:** `WCSession.isSupported()` is **false** — no session; diagnostics show "not supported".
- **watchOS Simulator:** same limitation for real WC; pairing behaviors are not production-representative.
- **Real devices:** paired Watch + iPhone with Watch app installed; both apps must have run at least once for realistic delivery.

### Further reading

- Operational troubleshooting: [`docs/testing/WATCH_CONNECTIVITY_TROUBLESHOOTING.md`](../testing/WATCH_CONNECTIVITY_TROUBLESHOOTING.md)
- Bundle ID / embedding rules: root [`README.md`](../../README.md) (Watch Connectivity section)
