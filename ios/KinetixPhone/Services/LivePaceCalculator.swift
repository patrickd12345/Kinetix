import Foundation

struct DistanceSample: Equatable {
    let timestamp: Date
    let totalDistanceMeters: Double
}

enum LivePaceCalculator {
    static let defaultRollingWindowSeconds: TimeInterval = 3

    static func rollingPace(
        from samples: [DistanceSample],
        windowSeconds: TimeInterval,
        now: Date = Date()
    ) -> Double {
        guard windowSeconds > 0, samples.count >= 2 else { return 0 }
        let sortedSamples = samples.sorted { $0.timestamp < $1.timestamp }
        guard let lastSample = sortedSamples.last else { return 0 }

        let endSample = DistanceSample(
            timestamp: min(now, lastSample.timestamp),
            totalDistanceMeters: lastSample.totalDistanceMeters
        )
        let windowStart = endSample.timestamp.addingTimeInterval(-windowSeconds)
        let startSample = sample(at: windowStart, within: sortedSamples)

        let distanceDelta = endSample.totalDistanceMeters - startSample.totalDistanceMeters
        let timeDelta = endSample.timestamp.timeIntervalSince(startSample.timestamp)

        guard distanceDelta >= 0.5, timeDelta > 0 else { return 0 }
        let pace = timeDelta / (distanceDelta / 1000.0)
        return pace.isFinite && !pace.isNaN && pace > 0 ? pace : 0
    }

    private static func sample(at targetTime: Date, within samples: [DistanceSample]) -> DistanceSample {
        guard let first = samples.first else {
            return DistanceSample(timestamp: targetTime, totalDistanceMeters: 0)
        }
        if targetTime <= first.timestamp { return first }

        guard let last = samples.last else { return first }
        if targetTime >= last.timestamp { return last }

        for index in 1..<samples.count {
            let previous = samples[index - 1]
            let current = samples[index]
            guard targetTime <= current.timestamp else { continue }

            let segmentDuration = current.timestamp.timeIntervalSince(previous.timestamp)
            guard segmentDuration > 0 else { return previous }

            let elapsed = targetTime.timeIntervalSince(previous.timestamp)
            let interpolation = elapsed / segmentDuration
            let interpolatedDistance = previous.totalDistanceMeters
                + (current.totalDistanceMeters - previous.totalDistanceMeters) * interpolation

            return DistanceSample(timestamp: targetTime, totalDistanceMeters: interpolatedDistance)
        }

        return last
    }
}
