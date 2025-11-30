
import SwiftUI
import SwiftData
#if os(watchOS)
import WatchKit
#endif

// MARK: - Helper Extensions

extension View {
    func attachPhysioAlert(showPhysioAlert: Binding<Bool>, locationManager: LocationManager, unitSystem: String) -> some View {
        self.alert("Cardiac Drift", isPresented: showPhysioAlert) {
            Button("Ignore", role: .cancel) { }
            Button("Okay", role: .none) { }
        } message: {
            Text("Efficiency dropping. Rec Pace: \(locationManager.recommendedPaceString(unit: unitSystem))")
        }
    }
    
    func attachGPSErrorAlert(showGPSError: Binding<Bool>, locationManager: LocationManager) -> some View {
        self.alert("GPS Error", isPresented: showGPSError) {
            Button("OK", role: .cancel) { locationManager.gpsError = nil }
            if locationManager.gpsStatus == .denied { Button("Settings") { } }
        } message: {
            if let error = locationManager.gpsError { Text(error) } else { Text("GPS signal lost or unavailable") }
        }
    }
    
    func attachHealthKitErrorAlert(showHealthKitError: Binding<Bool>, locationManager: LocationManager) -> some View {
        self.alert("HealthKit Error", isPresented: showHealthKitError) {
            Button("OK", role: .cancel) { locationManager.healthKitError = nil }
            Button("Settings") { }
        } message: {
            if let error = locationManager.healthKitError { Text(error) } else { Text("HealthKit access required for heart rate tracking") }
        }
    }
    
    func attachWorkoutErrorAlert(showWorkoutError: Binding<Bool>, locationManager: LocationManager) -> some View {
        self.alert("Workout Error", isPresented: showWorkoutError) {
            Button("OK", role: .cancel) { locationManager.workoutError = nil }
        } message: {
            if let error = locationManager.workoutError { Text(error) } else { Text("Workout session error occurred") }
        }
    }
    
    func attachRecoveryPrompt(showRecoveryPrompt: Binding<Bool>, locationManager: LocationManager, unitSystem: String) -> some View {
        self.alert("Resume Run?", isPresented: showRecoveryPrompt) {
            Button("Discard", role: .destructive) { locationManager.clearRecoveryData() }
            Button("Resume", role: .none) {
                if let recovery = locationManager.checkForRecovery() { locationManager.recoverRun(recovery) }
            }
        } message: {
            if let recovery = locationManager.checkForRecovery() {
                let dist = unitSystem == "metric" ?
                    String(format: "%.2f km", recovery.distance/1000) :
                    String(format: "%.2f mi", (recovery.distance/1000) * 0.621371)
                let time = Int(recovery.duration)
                let min = time / 60
                let sec = time % 60
                Text("Previous run detected: \(dist) in \(min):\(String(format: "%02d", sec)). Resume?")
            }
        }
    }
    
    func attachInvalidRunAlert(showInvalidRunAlert: Binding<Bool>, locationManager: LocationManager, targetNPI: Double, modelContext: ModelContext) -> some View {
        self.alert("Run Too Short", isPresented: showInvalidRunAlert) {
            Button("Discard", role: .destructive) { }
            Button("Save Anyway", role: .none) {
                if let summary = locationManager.toggleTracking(targetNPI: targetNPI) {
                    let run = Run(
                        date: summary.date,
                        distance: summary.distance,
                        duration: summary.duration,
                        avgPace: summary.avgPace,
                        avgNPI: summary.avgNPI,
                        avgHeartRate: summary.avgHeartRate,
                        routeData: summary.routeData
                    )
                    modelContext.insert(run)
                }
            }
        } message: {
            Text("This run is very short (< 100m or < 10s). Save anyway?")
        }
    }
    
    func attachChangeHandlers(locationManager: LocationManager, physioMode: Bool, targetNPI: Double, hasCelebrated: Binding<Bool>, showFireworks: Binding<Bool>, showPhysioAlert: Binding<Bool>, formCoach: FormCoach) -> some View {
        self
            .onChange(of: locationManager.liveNPI) { _, newValue in
                if round(newValue) >= targetNPI && !hasCelebrated.wrappedValue {
                    hasCelebrated.wrappedValue = true
                    showFireworks.wrappedValue = true
                    #if os(watchOS)
                    WKInterfaceDevice.current().play(.success)
                    let device = WKInterfaceDevice.current()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { device.play(.click) }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { device.play(.click) }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { device.play(.click) }
                    #endif
                    DispatchQueue.main.asyncAfter(deadline: .now() + 4) { showFireworks.wrappedValue = false }
                }
            }
            .onChange(of: locationManager.heartRate) { _, newHR in
                if physioMode && newHR > 175 && !showPhysioAlert.wrappedValue { showPhysioAlert.wrappedValue = true }
            }
            .onChange(of: locationManager.currentFormMetrics) { _, metrics in
                if locationManager.isRunning && !locationManager.isPaused {
                    formCoach.evaluate(metrics: metrics)
                }
            }
    }
}

