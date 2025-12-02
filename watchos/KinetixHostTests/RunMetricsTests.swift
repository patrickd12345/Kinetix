
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

    @Test("Calculate NPI (Efficiency Score)")
    func testCalculateNPI() {
        // Given: 5km in 25 minutes (1500 seconds)
        // Pace = 300s/km. Speed = 12 km/h.
        // Factor = 5^0.06 ≈ 1.101
        // NPI = 12 * 1.101 * 10 ≈ 132
        let distance = 5000.0
        let time = 1500.0
        
        // When
        let npi = RunMetricsCalculator.calculateNPI(distanceMeters: distance, durationSeconds: time)
        
        // Then
        // Use checking with accuracy for floating point math
        #expect(abs(npi - 132) < 1.0) 
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
}

