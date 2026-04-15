import XCTest
@testable import KinetixPhone

final class LivePaceCalculatorTests: XCTestCase {
    func testRollingPaceUsesConfiguredWindow() {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let samples = [
            DistanceSample(timestamp: start, totalDistanceMeters: 0),
            DistanceSample(timestamp: start.addingTimeInterval(3), totalDistanceMeters: 10)
        ]

        let pace = LivePaceCalculator.rollingPace(
            from: samples,
            windowSeconds: 3,
            now: start.addingTimeInterval(3)
        )

        XCTAssertEqual(pace, 300, accuracy: 0.001)
    }

    func testRollingPaceInterpolatesWhenWindowBoundaryFallsBetweenSamples() {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let samples = [
            DistanceSample(timestamp: start, totalDistanceMeters: 0),
            DistanceSample(timestamp: start.addingTimeInterval(2), totalDistanceMeters: 8),
            DistanceSample(timestamp: start.addingTimeInterval(4), totalDistanceMeters: 16)
        ]

        let pace = LivePaceCalculator.rollingPace(
            from: samples,
            windowSeconds: 3,
            now: start.addingTimeInterval(4)
        )

        XCTAssertEqual(pace, 375, accuracy: 0.001)
    }

    func testRollingPaceReturnsZeroForSparseOrStationaryData() {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let oneSample = [DistanceSample(timestamp: start, totalDistanceMeters: 0)]
        let stationary = [
            DistanceSample(timestamp: start, totalDistanceMeters: 100),
            DistanceSample(timestamp: start.addingTimeInterval(5), totalDistanceMeters: 100)
        ]

        XCTAssertEqual(
            LivePaceCalculator.rollingPace(from: oneSample, windowSeconds: 3, now: start.addingTimeInterval(3)),
            0
        )
        XCTAssertEqual(
            LivePaceCalculator.rollingPace(from: stationary, windowSeconds: 3, now: start.addingTimeInterval(5)),
            0
        )
    }

    func testRollingPaceDoesNotDriftWhenNowIsAfterLatestSample() {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let samples = [
            DistanceSample(timestamp: start, totalDistanceMeters: 0),
            DistanceSample(timestamp: start.addingTimeInterval(3), totalDistanceMeters: 12)
        ]

        let paceAtSample = LivePaceCalculator.rollingPace(
            from: samples,
            windowSeconds: 3,
            now: start.addingTimeInterval(3)
        )
        let paceLater = LivePaceCalculator.rollingPace(
            from: samples,
            windowSeconds: 3,
            now: start.addingTimeInterval(12)
        )

        XCTAssertEqual(paceAtSample, paceLater, accuracy: 0.001)
    }
}
