import { generateGeohash, decodeGeohash } from './crypto'

// Geohash precision to approximate area coverage
// precision 1: ~5000km x 5000km
// precision 2: ~1250km x 625km
// precision 3: ~156km x 156km
// precision 4: ~39km x 19.5km
// precision 5: ~4.9km x 4.9km
// precision 6: ~1.2km x 0.6km
// precision 7: ~152m x 152m
// precision 8: ~38m x 19m
// precision 9: ~4.8m x 4.8m

export interface GeohashCoverage {
  centerGeohash: string
  coveringGeohashes: string[]
  precision: number
}

// Get optimal geohash precision for given bounds
function getOptimalPrecision(bounds: L.LatLngBounds): number {
  const latDiff = Math.abs(bounds.getNorth() - bounds.getSouth())
  const lngDiff = Math.abs(bounds.getEast() - bounds.getWest())
  const maxDiff = Math.max(latDiff, lngDiff)

  // Choose precision based on the maximum dimension
  if (maxDiff > 10) return 1      // > 10 degrees
  if (maxDiff > 2) return 2       // > 2 degrees
  if (maxDiff > 0.5) return 3     // > 0.5 degrees
  if (maxDiff > 0.1) return 4     // > 0.1 degrees
  if (maxDiff > 0.02) return 5    // > 0.02 degrees
  if (maxDiff > 0.005) return 6   // > 0.005 degrees
  if (maxDiff > 0.001) return 7   // > 0.001 degrees
  return 8                        // Very zoomed in
}

// Base32 characters used in geohash (for future use)
// const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

// Get adjacent geohash in a given direction (future use)
// function getAdjacentGeohash(geohash: string, direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'): string {
//   // This is a simplified implementation
//   // For a complete implementation, we'd need neighbor lookup tables
//   const decoded = decodeGeohash(geohash)
//   if (!decoded) return geohash
//
//   const precision = geohash.length
//   let newLat = decoded.lat
//   let newLng = decoded.lng
//
//   // Approximate step size based on precision
//   const latStep = 180 / Math.pow(2, precision * 2.5)
//   const lngStep = 360 / Math.pow(2, precision * 2.5)
//
//   // Adjust coordinates based on direction
//   if (direction.includes('n')) newLat += latStep
//   if (direction.includes('s')) newLat -= latStep
//   if (direction.includes('e')) newLng += lngStep
//   if (direction.includes('w')) newLng -= lngStep
//
//   return generateGeohash(newLat, newLng, precision)
// }

// Calculate geohashes that cover the visible map area
export function calculateGeohashCoverage(bounds: L.LatLngBounds): GeohashCoverage {
  const center = bounds.getCenter()
  const precision = getOptimalPrecision(bounds)

  const centerGeohash = generateGeohash(center.lat, center.lng, precision)

  // Calculate 4 corner geohashes that together cover the bounds
  const nw = generateGeohash(bounds.getNorth(), bounds.getWest(), precision)
  const ne = generateGeohash(bounds.getNorth(), bounds.getEast(), precision)
  const sw = generateGeohash(bounds.getSouth(), bounds.getWest(), precision)
  const se = generateGeohash(bounds.getSouth(), bounds.getEast(), precision)

  // Return unique geohashes that cover the area
  const uniqueCorners = Array.from(new Set([nw, ne, sw, se]))

  return {
    centerGeohash,
    coveringGeohashes: uniqueCorners,
    precision
  }
}

// Get bounds for a geohash (for drawing rectangles)
export function getGeohashBounds(geohash: string): L.LatLngBounds | null {
  const decoded = decodeGeohash(geohash)
  if (!decoded) return null

  // @ts-ignore - L will be available at runtime
  return L.latLngBounds(
    [decoded.bounds.minLat, decoded.bounds.minLng],
    [decoded.bounds.maxLat, decoded.bounds.maxLng]
  )
}