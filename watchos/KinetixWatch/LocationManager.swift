import Foundation
import CoreLocation
import Combine
import HealthKit
import SwiftData

struct RunSummary {
    let distance: Double
    let duration: TimeInterval
    let avgPace: Double
    let avgNPI: Double
    let avgHeartRate: Double
    let date: Date
    let routeData: [RoutePoint]
}

class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    private let manager = CLLocationManager()
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    
    @Published var isRunning = false
    @Published var liveNPI: Double = 0.0
    @Published var totalDistance: Double = 0.0
    @Published var paceSeconds: Double = 0.0
    @Published var timeToBeat: String? = nil
    @Published var heartRate: Double = 0.0
    @Published var recommendedPace: Double = 0.0
    
    private var lastLocation: CLLocation?
    private var timer: Timer?
    private var duration: TimeInterval = 0
    private var activeTargetNPI: Double = 135.0
    
    // Data buffering
    private var rollingDistances: [(Date, Double)] = []
    @Published var currentPaceSeconds: Double = 0.0
    private var heartRateSamples: [Double] = []
    private var routeCoordinates: [RoutePoint] = []
    
    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.requestWhenInUseAuthorization()
        requestHealthAuthorization()
    }
    
    func requestHealthAuthorization() {
        let typesToShare: Set = [
            HKQuantityType.workoutType()
        ]
        
        let typesToRead: Set = [
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!
        ]
        
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { (success, error) in
            if !success {
                print("HealthKit authorization failed: \(String(describing: error))")
            }
        }
    }
    
    func toggleTracking(targetNPI: Double) -> RunSummary? {
        self.activeTargetNPI = targetNPI
        if isRunning {
            return stop()
        } else {
            start()
            return nil
        }
    }
    
    private func start() {
        isRunning = true
        totalDistance = 0
        liveNPI = 0
        duration = 0
        rollingDistances.removeAll()
        heartRateSamples.removeAll()
        routeCoordinates.removeAll()
        currentPaceSeconds = 0
        lastLocation = nil
        timeToBeat = nil
        recommendedPace = 0
        heartRate = 0
        
        startWorkout()
        manager.startUpdatingLocation()
        
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.duration += 1.0
            self.updateCalculations()
        }
    }
    
    private func stop() -> RunSummary {
        let summary = createRunSummary()
        isRunning = false
        manager.stopUpdatingLocation()
        timer?.invalidate()
        stopWorkout()
        return summary
    }
    
    private func createRunSummary() -> RunSummary {
        let avgHR = heartRateSamples.isEmpty ? 0.0 : heartRateSamples.reduce(0, +) / Double(heartRateSamples.count)
        let avgPace = totalDistance > 0 ? duration / (totalDistance / 1000.0) : 0.0
        
        return RunSummary(
            distance: totalDistance,
            duration: duration,
            avgPace: avgPace,
            avgNPI: liveNPI,
            avgHeartRate: avgHR,
            date: Date(),
            routeData: routeCoordinates
        )
    }
    
    private func startWorkout() {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .running
        configuration.locationType = .outdoor
        
        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            builder = workoutSession?.associatedWorkoutBuilder()
            
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
            
            workoutSession?.delegate = self
            builder?.delegate = self
            
            workoutSession?.startActivity(with: Date())
            builder?.beginCollection(withStart: Date()) { (success, error) in
                if !success {
                    print("Builder beginCollection failed: \(String(describing: error))")
                }
            }
        } catch {
            print("Failed to start workout session: \(error)")
        }
    }
    
    private func stopWorkout() {
        workoutSession?.end()
        builder?.endCollection(withEnd: Date()) { (success, error) in
            self.builder?.finishWorkout { (workout, error) in
                DispatchQueue.main.async {
                    self.workoutSession = nil
                    self.builder = nil
                }
            }
        }
    }
    
    // MARK: - CLLocationManagerDelegate
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last, isRunning else { return }
        
        // Filter poor GPS data
        if loc.horizontalAccuracy < 0 || loc.horizontalAccuracy > 50 { return }
        
        // Store coordinate for mapping
        routeCoordinates.append(RoutePoint(lat: loc.coordinate.latitude, lon: loc.coordinate.longitude))
        
        if let last = lastLocation {
            let dist = loc.distance(from: last)
            let timeDiff = loc.timestamp.timeIntervalSince(last.timestamp)
            
            // Filter unrealistic jumps (e.g. > 12m/s)
            if timeDiff > 0 && (dist / timeDiff) < 12.0 { 
                totalDistance += dist
                
                // Add to rolling buffer
                rollingDistances.append((Date(), dist))
            }
        }
        lastLocation = loc
        
        // Prune buffer to keep last 10 seconds
        let now = Date()
        rollingDistances = rollingDistances.filter { now.timeIntervalSince($0.0) < 10 }
    }
    
    // MARK: - HKWorkoutSessionDelegate
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        // Handle state changes if needed
    }
    
    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("Workout session failed: \(error)")
    }
    
    // MARK: - HKLiveWorkoutBuilderDelegate
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }
            guard let statistics = workoutBuilder.statistics(for: quantityType) else { continue }
            
            DispatchQueue.main.async {
                if quantityType == HKQuantityType.quantityType(forIdentifier: .heartRate) {
                    let heartRateUnit = HKUnit.count().unitDivided(by: HKUnit.minute())
                    let hr = statistics.mostRecentQuantity()?.doubleValue(for: heartRateUnit) ?? 0
                    self.heartRate = hr
                    if hr > 0 { self.heartRateSamples.append(hr) }
                }
            }
        }
    }
    
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
    }
    
    func updateCalculations() {
        if totalDistance > 0 {
            // Overall Avg Pace (for NPI)
            paceSeconds = duration / (totalDistance / 1000.0)
            
            // Calculate Rolling Pace (Last 10s) for Display
            let rollingDist = rollingDistances.map { $0.1 }.reduce(0, +)
            if !rollingDistances.isEmpty && rollingDist > 0 {
                // Time window is roughly from oldest point to now
                if let first = rollingDistances.first {
                    let window = Date().timeIntervalSince(first.0)
                    if window > 0 {
                        currentPaceSeconds = window / (rollingDist / 1000.0)
                    }
                }
            } else {
                currentPaceSeconds = paceSeconds // Fallback to avg
            }
            
            // Rec Pace (Current + 30s)
            recommendedPace = currentPaceSeconds + 30.0
            
            // Require at least 100m distance and 30s duration for NPI to stabilize
            if totalDistance > 100 && duration > 30 {
                // NPI Formula
                let speedKmH = (1000/paceSeconds) * 3.6
                let factor = pow((totalDistance/1000.0), 0.06)
                liveNPI = speedKmH * factor * 10.0
                
                // Projection Logic (Using Avg Pace)
                let roundingThreshold = activeTargetNPI - 0.5
                let term = 10 * ((roundingThreshold * (duration/60)/(totalDistance/1000)) / 500 - 1)
                
                if term < 5 {
                    let distNeeded = exp(term) - 0.1
                    let distRemaining = distNeeded - (totalDistance/1000.0)
                    
                    if distRemaining > 0 {
                        let timeSecs = distRemaining * paceSeconds
                        let m = Int(timeSecs / 60)
                        let s = Int(timeSecs.truncatingRemainder(dividingBy: 60))
                        
                        // Format Pace for Display
                        let paceMin = Int(paceSeconds / 60)
                        let paceSec = Int(paceSeconds.truncatingRemainder(dividingBy: 60))
                        
                        timeToBeat = String(format: "%d:%02d @ AVG %d:%02d", m, s, paceMin, paceSec)
                    } else {
                        timeToBeat = "GO GO GO!"
                    }
                } else {
                    timeToBeat = "INCREASE PACE"
                }
            }
        }
    }
    
    func formattedPace(unit: String) -> String {
        // Use currentPaceSeconds (Rolling) for display instead of Avg
        if currentPaceSeconds.isInfinite || currentPaceSeconds.isNaN { return "0:00" }
        let pace = unit == "metric" ? currentPaceSeconds : currentPaceSeconds * 1.60934
        if pace.isInfinite || pace.isNaN || pace > 359999 { return "0:00" } // Guard against huge values
        return String(format: "%d:%02d", Int(pace/60), Int(pace.truncatingRemainder(dividingBy: 60)))
    }
    
    func recommendedPaceString(unit: String) -> String {
        if recommendedPace.isInfinite || recommendedPace.isNaN { return "0:00" }
        let pace = unit == "metric" ? recommendedPace : recommendedPace * 1.60934
        if pace.isInfinite || pace.isNaN || pace > 359999 { return "0:00" }
        return String(format: "%d:%02d", Int(pace/60), Int(pace.truncatingRemainder(dividingBy: 60)))
    }
    
    func formattedDistance(unit: String) -> String {
        let dist = unit == "metric" ? totalDistance/1000 : (totalDistance/1000) * 0.621371
        return String(format: "%.2f", dist)
    }
}
