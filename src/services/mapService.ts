import { BehaviorSubject } from 'rxjs'
import { LocationEvent } from '../types'
import { decodeGeohash } from '../utils/crypto'

export interface MapLocation {
  id: string
  lat: number
  lng: number
  bounds: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  }
  event: LocationEvent
}

export interface FocusOptions {
  zoomLevel?: number
  fitBounds?: boolean
}

class MapService {
  public locations$ = new BehaviorSubject<MapLocation[]>([])
  public focusLocation$ = new BehaviorSubject<{ id: string | null, options?: FocusOptions }>({
    id: null,
    options: undefined
  })
  private focusedLocation$ = new BehaviorSubject<MapLocation | null>(null)
  private popupLocation$ = new BehaviorSubject<string | null>(null)
  // private mapInstance: any = null // Reserved for future use

  // Get all locations for map display
  getLocations() {
    return this.locations$.asObservable()
  }

  // Get currently focused location
  getFocusedLocation() {
    return this.focusedLocation$.asObservable()
  }

  // Get location that should have popup opened
  getPopupLocation() {
    return this.popupLocation$.asObservable()
  }

  // Update locations from events
  updateLocations(events: LocationEvent[]) {
    const mapLocations: MapLocation[] = []

    // Check visibility settings
    const fetchAllGeohashEvents = localStorage.getItem('spotstr_fetchAllGeohashEvents') === 'true'

    for (const event of events) {
      // Skip encrypted geohashes for now
      if (event.geohash && event.geohash !== 'encrypted') {
        // Filter based on visibility settings
        const isLocationEvent = event.eventKind === 30472 || event.eventKind === 30473

        // Show location events always, show other events only if setting is enabled
        if (isLocationEvent || fetchAllGeohashEvents) {
          const decoded = decodeGeohash(event.geohash)
          if (decoded) {
            mapLocations.push({
              id: event.id,
              lat: decoded.lat,
              lng: decoded.lng,
              bounds: decoded.bounds,
              event
            })
          }
        }
      }
    }

    this.locations$.next(mapLocations)
  }

  // Focus map on specific location and open its popup
  focusLocationAndOpenPopup(locationId: string, options?: FocusOptions) {
    const locations = this.locations$.value
    const location = locations.find(l => l.id === locationId)
    if (location) {
      // Calculate zoom based on geohash if not provided
      if (!options?.zoomLevel) {
        const geohashLength = location.event.geohash.length
        let zoomLevel = 18 // default

        // Map geohash precision to zoom levels for proper visibility
        if (geohashLength <= 1) zoomLevel = 2      // ~5000km
        else if (geohashLength === 2) zoomLevel = 5  // ~625km
        else if (geohashLength === 3) zoomLevel = 8  // ~78km
        else if (geohashLength === 4) zoomLevel = 11 // ~20km
        else if (geohashLength === 5) zoomLevel = 13 // ~2.4km
        else if (geohashLength === 6) zoomLevel = 15 // ~610m
        else if (geohashLength === 7) zoomLevel = 17 // ~76m
        else if (geohashLength >= 8) zoomLevel = 18  // ~19m

        options = { ...options, zoomLevel, fitBounds: true }
      }

      this.focusedLocation$.next(location)
      this.focusLocation$.next({ id: locationId, options })  // Trigger with options
      this.popupLocation$.next(locationId)
    }
  }

  // Set map instance
  setMap(map: any) {
    // this.mapInstance = map // Reserved for future use
    console.log('MapService: Map instance set', !!map)
  }

  // Focus map on specific location
  focusLocation(locationId: string, options?: FocusOptions) {
    const locations = this.locations$.value
    const location = locations.find(l => l.id === locationId)
    if (location) {
      this.focusedLocation$.next(location)
      this.focusLocation$.next({ id: locationId, options })
    }
  }

  // Clear focus
  clearFocus() {
    this.focusedLocation$.next(null)
  }

  // Clear popup
  clearPopup() {
    this.popupLocation$.next(null)
  }
}

export const mapService = new MapService()