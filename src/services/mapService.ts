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

class MapService {
  private locations$ = new BehaviorSubject<MapLocation[]>([])
  private focusedLocation$ = new BehaviorSubject<MapLocation | null>(null)
  private popupLocation$ = new BehaviorSubject<string | null>(null)

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

    for (const event of events) {
      // Skip encrypted geohashes for now
      if (event.geohash && event.geohash !== 'encrypted') {
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

    this.locations$.next(mapLocations)
  }

  // Focus map on specific location and open its popup
  focusLocationAndOpenPopup(locationId: string) {
    const locations = this.locations$.value
    const location = locations.find(l => l.id === locationId)
    if (location) {
      this.focusedLocation$.next(location)
      this.popupLocation$.next(locationId)
    }
  }

  // Focus map on specific location
  focusLocation(locationId: string) {
    const locations = this.locations$.value
    const location = locations.find(l => l.id === locationId)
    if (location) {
      this.focusedLocation$.next(location)
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