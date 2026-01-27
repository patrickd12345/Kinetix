import Foundation

/// Canonical KPS (Kinetix Performance Score) helper.
///
/// - Range: 0–100 inclusive
/// - 100 always represents the user's current lifetime PB reference (pb_eq5k_sec)
/// - Scores never display above 100
/// - Any run that would score >100 is treated as a new lifetime PB and becomes the new 100 reference
///
/// Canonical math:
/// - Compute eq5k_sec using Riegel: T₂ = T₁ × (D₂/D₁)^1.06
/// - pb_eq5k_sec = minimum eq5k_sec ever recorded (strictly faster only)
/// - score_raw = 100 * (pb_eq5k_sec / eq5k_sec)
/// - If eq5k_sec < pb_eq5k_sec: update PB to this run and set KPS = 100
/// - Else: KPS = min(100, score_raw)
enum KpsCalculator {
    static let riegelExponent: Double = 1.06
    static let referenceDistanceKm: Double = 5.0
    
    struct Result {
        let kps: Double
        let eq5kSec: Double?
        let pbEq5kSecNext: Double?
        let setPb: Bool
    }
    
    static func computeEq5kSeconds(distanceMeters: Double, durationSeconds: Double) -> Double? {
        guard distanceMeters.isFinite, durationSeconds.isFinite else { return nil }
        guard distanceMeters > 0, durationSeconds > 0 else { return nil }
        let distanceKm = distanceMeters / 1000.0
        guard distanceKm > 0 else { return nil }
        return durationSeconds * pow(referenceDistanceKm / distanceKm, riegelExponent)
    }
    
    static func computeKps(distanceMeters: Double, durationSeconds: Double, pbEq5kSec: Double?) -> Result {
        guard let eq5k = computeEq5kSeconds(distanceMeters: distanceMeters, durationSeconds: durationSeconds) else {
            return Result(kps: 0, eq5kSec: nil, pbEq5kSecNext: pbEq5kSec, setPb: false)
        }
        
        // Initialize PB on first valid run.
        guard let pb = pbEq5kSec, pb.isFinite, pb > 0 else {
            return Result(kps: 100, eq5kSec: eq5k, pbEq5kSecNext: eq5k, setPb: true)
        }
        
        // Strictly faster only — ties do NOT replace PB.
        if eq5k < pb {
            return Result(kps: 100, eq5kSec: eq5k, pbEq5kSecNext: eq5k, setPb: true)
        }
        
        let scoreRaw = 100.0 * (pb / eq5k)
        return Result(kps: min(100.0, scoreRaw), eq5kSec: eq5k, pbEq5kSecNext: pb, setPb: false)
    }
}

