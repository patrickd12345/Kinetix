import Foundation
import Sentry

enum KinetixSentry {
    static func configure() {
#if targetEnvironment(simulator)
        return
#else
#if DEBUG
        return
#else
        let raw = (Bundle.main.object(forInfoDictionaryKey: "SENTRY_DSN") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return }

        SentrySDK.start { options in
            options.dsn = raw
            options.tracesSampleRate = 0.1
        }
#endif
#endif
    }
}
