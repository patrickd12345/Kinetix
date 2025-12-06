import Foundation
import CoreLocation
import SwiftUI
import Combine

enum GPSStatus {
    case unknown
    case searching
    case excellent
    case good
    case poor
    case denied
    case failed
}

/// Manages all GPS-related functionality for iPhone
class GPSManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    
    @Published var status: GPSStatus = .unknown
    @Published var accuracy: Double? = nil
    @Published var lastUpdate: Date? = nil
    @Published var error: String? = nil
    
    @Published var currentLocation: CLLocation?
    var routeCoordinates: [RoutePoint] = []
    
    var onLocationUpdate: ((CLLocation) -> Void)?
    var onStatusChange: ((GPSStatus) -> Void)?
    
    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5.0 // Update every 5 meters
        checkAuthorization()
    }
    
    // MARK: - Public API
    
    func requestAuthorization() {
        manager.requestWhenInUseAuthorization()
    }
    
    func startTracking() {
        manager.startUpdatingLocation()
        updateStatus(.searching)
    }
    
    func stopTracking() {
        manager.stopUpdatingLocation()
    }
    
    func checkAuthorization() {
        let authStatus = manager.authorizationStatus
        switch authStatus {
        case .notDetermined:
            updateStatus(.unknown)
        case .restricted, .denied:
            updateStatus(.denied)
            error = "GPS access denied. Enable in Settings > Privacy & Security > Location Services."
        case .authorizedWhenInUse, .authorizedAlways:
            // Status will update when we get location data
            break
        @unknown default:
            updateStatus(.unknown)
        }
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        currentLocation = location
        lastUpdate = Date()
        
        // Update route
        let routePoint = RoutePoint(
            lat: location.coordinate.latitude,
            lon: location.coordinate.longitude
        )
        routeCoordinates.append(routePoint)
        
        // Update status based on accuracy
        updateGPSStatus(accuracy: location.horizontalAccuracy)
        
        // Notify delegate
        onLocationUpdate?(location)
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                updateStatus(.denied)
                self.error = "GPS access denied. Enable in Settings."
            case .locationUnknown:
                updateStatus(.poor)
            default:
                updateStatus(.failed)
                self.error = "GPS error: \(error.localizedDescription)"
            }
        } else {
            updateStatus(.failed)
            self.error = "GPS error: \(error.localizedDescription)"
        }
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        checkAuthorization()
    }
    
    // MARK: - Private Helpers
    
    private func updateGPSStatus(accuracy: Double) {
        self.accuracy = accuracy
        
        if accuracy < 0 {
            updateStatus(.poor)
        } else if accuracy <= 5 {
            updateStatus(.excellent)
        } else if accuracy <= 20 {
            updateStatus(.good)
        } else if accuracy <= 50 {
            updateStatus(.poor)
        } else {
            updateStatus(.searching)
        }
    }
    
    private func updateStatus(_ newStatus: GPSStatus) {
        status = newStatus
        onStatusChange?(newStatus)
    }
    
    func reset() {
        routeCoordinates.removeAll()
        currentLocation = nil
        accuracy = nil
        lastUpdate = nil
        error = nil
    }
    
    // Distance calculation helper
    func calculateDistance(from: CLLocation, to: CLLocation) -> Double {
        return to.distance(from: from)
    }
}




