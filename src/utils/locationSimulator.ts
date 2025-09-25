// Location simulator for testing
// Simulates circular movement around Madeira center

interface SimulatedPosition {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
    altitude: number | null
    altitudeAccuracy: number | null
    heading: number | null
    speed: number | null
  }
  timestamp: number
}

class LocationSimulator {
  private centerLat = 32.742293  // center latitude
  private centerLng = -17.006128  // center longitude
  private radiusKm = 5  // 5 km radius
  private speedMs = 10  // 10 meters per second
  private updateInterval = 1000  // 1 second update interval
  private startTime = Date.now()
  private watchCallbacks = new Map<number, (position: SimulatedPosition) => void>()
  private errorCallbacks = new Map<number, (error: GeolocationPositionError) => void>()
  private watchIntervals = new Map<number, ReturnType<typeof setInterval>>()
  private nextWatchId = 1

  // Convert kilometers to degrees (approximate)
  private kmToDegrees(km: number, latitude: number): { lat: number; lng: number } {
    const latDegrees = km / 111.0  // 1 degree latitude = ~111 km
    const lngDegrees = km / (111.0 * Math.cos(latitude * Math.PI / 180))  // longitude degrees vary by latitude
    return { lat: latDegrees, lng: lngDegrees }
  }

  // Calculate position at given time
  private calculatePosition(elapsedMs: number): SimulatedPosition {
    // Calculate angle based on circular motion
    // Full circle circumference = 2 * π * radius
    const circumferenceKm = 2 * Math.PI * this.radiusKm
    const circumferenceM = circumferenceKm * 1000
    const timeForFullCircleMs = circumferenceM / this.speedMs * 1000
    const angle = (elapsedMs / timeForFullCircleMs) * 2 * Math.PI

    // Calculate position on circle
    const degrees = this.kmToDegrees(this.radiusKm, this.centerLat)
    const lat = this.centerLat + degrees.lat * Math.cos(angle)
    const lng = this.centerLng + degrees.lng * Math.sin(angle)

    // Calculate heading (direction of movement)
    const heading = ((angle + Math.PI / 2) * 180 / Math.PI) % 360

    return {
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy: 10,  // 10 meters accuracy
        altitude: null,
        altitudeAccuracy: null,
        heading: heading,
        speed: this.speedMs
      },
      timestamp: Date.now()
    }
  }

  // Simulate getCurrentPosition
  getCurrentPosition(
    successCallback: (position: SimulatedPosition) => void,
    _errorCallback?: (error: GeolocationPositionError) => void,
    _options?: PositionOptions
  ): void {
    // Simulate async behavior
    setTimeout(() => {
      const elapsedMs = Date.now() - this.startTime
      const position = this.calculatePosition(elapsedMs)
      successCallback(position)
    }, 100)  // Small delay to simulate GPS
  }

  // Simulate watchPosition
  watchPosition(
    successCallback: (position: SimulatedPosition) => void,
    errorCallback?: (error: GeolocationPositionError) => void,
    _options?: PositionOptions
  ): number {
    const watchId = this.nextWatchId++
    console.log('[Simulator] watchPosition starting with watchId:', watchId)

    this.watchCallbacks.set(watchId, successCallback)
    if (errorCallback) {
      this.errorCallbacks.set(watchId, errorCallback)
    }

    // Send initial position
    const initialElapsed = Date.now() - this.startTime
    const initialPosition = this.calculatePosition(initialElapsed)
    setTimeout(() => successCallback(initialPosition), 100)

    // Set up interval for updates
    const interval = setInterval(() => {
      const elapsedMs = Date.now() - this.startTime
      const position = this.calculatePosition(elapsedMs)
      const callback = this.watchCallbacks.get(watchId)
      if (callback) {
        callback(position)
      }
    }, this.updateInterval)

    this.watchIntervals.set(watchId, interval)
    return watchId
  }

  // Simulate clearWatch
  clearWatch(watchId: number): void {
    console.log('[Simulator] clearWatch called for watchId:', watchId)
    const interval = this.watchIntervals.get(watchId)
    if (interval) {
      clearInterval(interval)
      this.watchIntervals.delete(watchId)
      console.log('[Simulator] Interval cleared for watchId:', watchId)
    } else {
      console.log('[Simulator] No interval found for watchId:', watchId)
    }

    this.watchCallbacks.delete(watchId)
    this.errorCallbacks.delete(watchId)
  }
}

// Create singleton instance
export const locationSimulator = new LocationSimulator()

// Check if simulation is enabled
export function isSimulationEnabled(): boolean {
  return localStorage.getItem('spotstr_simulateLocation') === 'true'
}

// Get geolocation implementation (real or simulated)
export function getGeolocationImplementation() {
  if (isSimulationEnabled()) {
    return {
      getCurrentPosition: locationSimulator.getCurrentPosition.bind(locationSimulator),
      watchPosition: locationSimulator.watchPosition.bind(locationSimulator),
      clearWatch: locationSimulator.clearWatch.bind(locationSimulator)
    }
  } else {
    return navigator.geolocation
  }
}