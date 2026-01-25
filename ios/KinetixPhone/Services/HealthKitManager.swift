import Foundation
import HealthKit
import Combine

/// Manages HealthKit heart rate collection for iPhone
/// Uses iOS 17+ compatible APIs (HKAnchoredObjectQuery for heart rate, HKWorkoutBuilder for workouts)
class HealthKitManager: NSObject, ObservableObject {
    private let healthStore = HKHealthStore()
    private var heartRateQuery: HKAnchoredObjectQuery?
    private var workoutBuilder: HKWorkoutBuilder?
    private var workoutStartDate: Date?
    private var workoutActivityType: HKWorkoutActivityType = .running
    
    @Published var heartRate: Double = 0.0
    @Published var error: String? = nil
    @Published var isActive: Bool = false
    
    var onHeartRateUpdate: ((Double) -> Void)?
    
    override init() {
        super.init()
        requestAuthorization()
    }
    
    // MARK: - Public API
    
    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else {
            error = "HealthKit is not available on this device"
            return
        }
        
        let typesToRead: Set<HKQuantityType> = [
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!
        ]
        
        let typesToShare: Set = [
            HKQuantityType.workoutType()
        ]
        
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { [weak self] success, error in
            DispatchQueue.main.async {
                if !success {
                    let errorMsg = error?.localizedDescription ?? "Unknown error"
                    self?.error = "HealthKit access denied: \(errorMsg). Enable in Settings > Privacy & Security > Health"
                } else {
                    self?.error = nil
                }
            }
        }
    }
    
    func startWorkout(activityType: HKWorkoutActivityType = .running) {
        guard HKHealthStore.isHealthDataAvailable() else {
            error = "HealthKit is not available on this device"
            return
        }
        
        workoutStartDate = Date()
        workoutActivityType = activityType
        
        // Create workout builder (iOS 17+)
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activityType
        configuration.locationType = .outdoor
        
        workoutBuilder = HKWorkoutBuilder(healthStore: healthStore, configuration: configuration, device: nil)
        
        // Begin workout collection
        workoutBuilder?.beginCollection(withStart: workoutStartDate!) { [weak self] success, error in
            DispatchQueue.main.async {
                if success {
                    // Start heart rate query
                    self?.startHeartRateQuery()
                    self?.isActive = true
                } else if let error = error {
                    self?.error = "Failed to start workout: \(error.localizedDescription)"
                }
            }
        }
    }
    
    func stopWorkout() {
        // Stop heart rate query
        stopHeartRateQuery()
        
        // Finish workout using HKWorkoutBuilder (iOS 17+)
        if let builder = workoutBuilder {
            builder.finishWorkout { [weak self] workout, error in
                DispatchQueue.main.async {
                    if let error = error {
                        self?.error = "Failed to save workout: \(error.localizedDescription)"
                    }
                    self?.isActive = false
                    self?.workoutBuilder = nil
                    self?.workoutStartDate = nil
                }
            }
        } else {
            DispatchQueue.main.async {
                self.isActive = false
                self.workoutBuilder = nil
                self.workoutStartDate = nil
            }
        }
    }
    
    // MARK: - Heart Rate Query (iOS 17+ compatible)
    
    private func startHeartRateQuery() {
        guard let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            return
        }
        
        // Create anchored query to get latest heart rate samples
        let query = HKAnchoredObjectQuery(
            type: heartRateType,
            predicate: nil,
            anchor: nil,
            limit: HKObjectQueryNoLimit
        ) { [weak self] query, samples, deletedObjects, anchor, error in
            guard let self = self, let samples = samples as? [HKQuantitySample] else {
                return
            }
            
            // Get most recent heart rate
            if let mostRecent = samples.last {
                let heartRate = mostRecent.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
                DispatchQueue.main.async {
                    self.heartRate = heartRate
                    self.onHeartRateUpdate?(heartRate)
                }
            }
        }
        
        // Update handler for new samples
        query.updateHandler = { [weak self] query, samples, deletedObjects, anchor, error in
            guard let self = self, let samples = samples as? [HKQuantitySample] else {
                return
            }
            
            // Get most recent heart rate
            if let mostRecent = samples.last {
                let heartRate = mostRecent.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
                DispatchQueue.main.async {
                    self.heartRate = heartRate
                    self.onHeartRateUpdate?(heartRate)
                }
            }
        }
        
        heartRateQuery = query
        healthStore.execute(query)
    }
    
    private func stopHeartRateQuery() {
        if let query = heartRateQuery {
            healthStore.stop(query)
            heartRateQuery = nil
        }
    }
}
