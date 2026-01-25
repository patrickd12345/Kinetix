import Foundation
import HealthKit
import Combine

/// Manages HealthKit workout sessions and heart rate collection
class HealthKitManager: NSObject, ObservableObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    
    @Published var heartRate: Double = 0.0
    @Published var error: String? = nil
    @Published var isActive: Bool = false
    
    var onHeartRateUpdate: ((Double) -> Void)?
    var onFormMetricsUpdate: ((FormMetrics) -> Void)?
    
    override init() {
        super.init()
        requestAuthorization()
    }
    
    // MARK: - Public API
    
    func requestAuthorization() {
        var typesToRead: Set<HKQuantityType> = [
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!
        ]
        
        // Add running form metrics if available (watchOS 7+)
        if let verticalOsc = HKQuantityType.quantityType(forIdentifier: .runningVerticalOscillation) {
            typesToRead.insert(verticalOsc)
        }
        if let strideLen = HKQuantityType.quantityType(forIdentifier: .runningStrideLength) {
            typesToRead.insert(strideLen)
        }
        if let gct = HKQuantityType.quantityType(forIdentifier: .runningGroundContactTime) {
            typesToRead.insert(gct)
        }
        
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
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activityType
        configuration.locationType = .outdoor
        
        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            builder = workoutSession?.associatedWorkoutBuilder()
            
            workoutSession?.delegate = self
            builder?.delegate = self
            
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
            
            let startDate = Date()
            workoutSession?.startActivity(with: startDate)
            builder?.beginCollection(withStart: startDate) { success, error in
                DispatchQueue.main.async {
                    if success {
                        self.isActive = true
                    } else if let error = error {
                        self.error = "Failed to start workout: \(error.localizedDescription)"
                    }
                }
            }
        } catch {
            self.error = "Failed to create workout session: \(error.localizedDescription)"
        }
    }
    
    func stopWorkout() {
        guard let session = workoutSession else { return }
        
        let endDate = Date()
        session.end()
        builder?.endCollection(withEnd: endDate) { success, error in
            DispatchQueue.main.async {
                if success {
                    self.builder?.finishWorkout { workout, error in
                        // Workout saved to HealthKit
                    }
                }
                self.isActive = false
                self.workoutSession = nil
                self.builder = nil
            }
        }
    }
    
    // MARK: - HKWorkoutSessionDelegate
    
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        // Handle state changes if needed
    }
    
    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.error = "Workout session error: \(error.localizedDescription)"
            self.isActive = false
        }
    }
    
    // MARK: - HKLiveWorkoutBuilderDelegate
    
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        var formMetrics = FormMetrics()
        formMetrics.heartRate = self.heartRate
        
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }
            
            let statistics = workoutBuilder.statistics(for: quantityType)
            
            if quantityType == HKQuantityType.quantityType(forIdentifier: .heartRate) {
                if let heartRate = statistics?.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute())) {
                    DispatchQueue.main.async {
                        self.heartRate = heartRate
                        formMetrics.heartRate = heartRate
                        self.onHeartRateUpdate?(heartRate)
                    }
                }
            }
            
            // Vertical Oscillation
            if quantityType == HKQuantityType.quantityType(forIdentifier: .runningVerticalOscillation) {
                if let osc = statistics?.mostRecentQuantity()?.doubleValue(for: HKUnit(from: "cm")) {
                    formMetrics.verticalOscillation = osc
                }
            }
            
            // Stride Length
            if quantityType == HKQuantityType.quantityType(forIdentifier: .runningStrideLength) {
                if let stride = statistics?.mostRecentQuantity()?.doubleValue(for: HKUnit.meter()) {
                    formMetrics.strideLength = stride
                }
            }
            
            // Ground Contact Time
            if quantityType == HKQuantityType.quantityType(forIdentifier: .runningGroundContactTime) {
                if let gct = statistics?.mostRecentQuantity()?.doubleValue(for: HKUnit(from: "ms")) {
                    formMetrics.groundContactTime = gct
                }
            }
        }
        
        DispatchQueue.main.async {
            self.onFormMetricsUpdate?(formMetrics)
        }
    }
    
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
        // Handle workout events if needed
    }
}

