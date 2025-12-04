/**
 * GPS tracking service using browser Geolocation API
 */
export class GPSService {
  constructor() {
    this.watchId = null;
    this.callbacks = new Set();
    this.currentPosition = null;
    this.status = 'unknown'; // unknown, searching, good, poor, denied, failed
    this.routePoints = [];
  }

  /**
   * Check if GPS is available
   */
  isAvailable() {
    return 'geolocation' in navigator;
  }

  /**
   * Request permission and get initial position
   */
  async requestPermission() {
    if (!this.isAvailable()) {
      this.status = 'failed';
      throw new Error('Geolocation is not available');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentPosition = position;
          this.status = this._getStatusFromAccuracy(position.coords.accuracy);
          resolve(position);
        },
        (error) => {
          this.status = error.code === 1 ? 'denied' : 'failed';
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * Start tracking position
   */
  startTracking(options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Geolocation is not available');
    }

    if (this.watchId !== null) {
      this.stopTracking();
    }

    const {
      highAccuracy = true,
      timeout = 10000,
      maximumAge = 0,
      interval = 1000, // ms
    } = options;

    let lastUpdate = 0;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastUpdate >= interval) {
          this.currentPosition = position;
          this.status = this._getStatusFromAccuracy(position.coords.accuracy);
          
          const routePoint = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: new Date(),
            accuracy: position.coords.accuracy,
          };
          
          this.routePoints.push(routePoint);
          
          // Notify all callbacks
          this.callbacks.forEach((callback) => {
            callback(position, routePoint);
          });
          
          lastUpdate = now;
        }
      },
      (error) => {
        this.status = error.code === 1 ? 'denied' : 'failed';
        this.callbacks.forEach((callback) => {
          if (callback.onError) callback.onError(error);
        });
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge,
      }
    );

    this.status = 'searching';
  }

  /**
   * Stop tracking
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Subscribe to position updates
   */
  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Get current route points
   */
  getRoutePoints() {
    return [...this.routePoints];
  }

  /**
   * Clear route points
   */
  clearRoute() {
    this.routePoints = [];
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate total distance from route points
   */
  calculateTotalDistance() {
    if (this.routePoints.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < this.routePoints.length; i++) {
      const prev = this.routePoints[i - 1];
      const curr = this.routePoints[i];
      total += GPSService.calculateDistance(
        prev.lat,
        prev.lon,
        curr.lat,
        curr.lon
      );
    }
    return total;
  }

  _getStatusFromAccuracy(accuracy) {
    if (accuracy < 10) return 'good';
    if (accuracy < 30) return 'good';
    if (accuracy < 50) return 'poor';
    return 'poor';
  }
}

// Singleton instance
export const gpsService = new GPSService();


