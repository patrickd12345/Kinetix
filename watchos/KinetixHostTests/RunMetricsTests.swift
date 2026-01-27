
import Testing
import Foundation

// Note: Ensure "RunMetricsCalculator.swift" is included in the KinetixHost target,
// or make the class public if it's in a module.
// Since KinetixHost embeds KinetixWatch files, we can access it.

struct RunMetricsTests {

    @Test("Calculate Pace (Seconds per KM)")
    func testCalculatePace() {
        // Given: 1000 meters (1km) in 300 seconds (5 mins)
        let distance = 1000.0
        let time = 300.0
        
        // When
        let pace = RunMetricsCalculator.calculatePace(distanceMeters: distance, durationSeconds: time)
        
        // Then
        #expect(pace == 300.0) // Expect 300s/km (5:00/km)
    }

    @Test("Calculate KPS (PB-aware 0–100)")
    func testCalculateKps() {
        // Given: first valid run sets PB and returns KPS=100
        let distance = 5000.0
        let time = 1500.0
        
        let first = KpsCalculator.computeKps(distanceMeters: distance, durationSeconds: time, pbEq5kSec: nil)
        #expect(first.setPb == true)
        #expect(first.kps == 100.0)
        
        // Slower run should score below 100 vs the stored PB
        let slower = KpsCalculator.computeKps(distanceMeters: distance, durationSeconds: 1560.0, pbEq5kSec: first.pbEq5kSecNext)
        #expect(slower.setPb == false)
        #expect(slower.kps < 100.0)
    }

    @Test("Rolling Pace Update (Window Logic)")
    func testRollingPace() async throws {
        var buffer: [(Date, Double)] = []
        
        // 1. Add first pace: 300s/km
        let _ = RunMetricsCalculator.updateRollingPace(buffer: &buffer, currentPace: 300.0, windowSeconds: 5.0)
        #expect(buffer.count == 1)
        
        // 2. Wait a bit (simulated by just manipulating dates if possible, 
        // but for this unit test we rely on the function using Date())
        // Since the function uses Date() internally, we can't mock time easily without dependency injection.
        // However, for a simple test, we can just check the average logic.
        
        // Add another pace: 320s/km
        let avg = RunMetricsCalculator.updateRollingPace(buffer: &buffer, currentPace: 320.0, windowSeconds: 5.0)
        
        // Average of 300 and 320 should be 310
        #expect(avg == 310.0)
        #expect(buffer.count == 2)
    }

    // Note: Finish-time and race projections were based on the legacy index metric and were removed
    // when KPS became the single canonical score.
}

