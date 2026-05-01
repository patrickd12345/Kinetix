import Foundation
#if canImport(Sentry)
import Sentry
#endif

enum KinetixSentry {
    static func configure() {
#if targetEnvironment(simulator)
        return
#elseif DEBUG
        return
#else
#if canImport(Sentry)
        let raw = (Bundle.main.object(forInfoDictionaryKey: "SENTRY_DSN") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return }

        SentrySDK.start { options in
            options.dsn = raw
            options.tracesSampleRate = 0.1
        }
#else
        // Add https://github.com/getsentry/sentry-cocoa via SPM to enable crash reporting.
#endif
#endif
    }
}
