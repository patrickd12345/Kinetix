import Foundation

/// KX-WATCH-024: stable keys for WatchConnectivity diagnostics (ping/pong).
/// Keep in sync with `docs/kinetix/KX-WATCH-024-watch-connectivity-contract.md`.
enum KinetixWatchConnectivityDiagnostics {
    static let messageKey = "kx_diag_v1"
    static let ping = "ping"
    static let pong = "pong"
    static let pongTimestampKey = "pong_ts"
}
