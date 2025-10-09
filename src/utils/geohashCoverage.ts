import { generateGeohash, decodeGeohash } from './crypto'

// Calculate map area size in degrees (returns max of lat/lng dimensions)
export function calculateMapAreaSize(bounds: L.LatLngBounds): { latSize: number, lngSize: number, maxSize: number } {
  const latSize = bounds.getNorth() - bounds.getSouth()
  const lngSize = bounds.getEast() - bounds.getWest()
  return {
    latSize,
    lngSize,
    maxSize: Math.max(latSize, lngSize)
  }
}

// Calculate geohash cell size in degrees for a given precision
export function calculateGeohashSize(precision: number): { latSize: number, lngSize: number, maxSize: number } {
  const latRange = 180.0 // Total latitude range (-90 to 90)
  const lngRange = 360.0 // Total longitude range (-180 to 180)

  // More precise bit allocation: geohash alternates lng/lat bits
  const totalBits = precision * 5
  const lngBits = Math.ceil(totalBits / 2)
  const latBits = Math.floor(totalBits / 2)

  const latDivisions = Math.pow(2, latBits)
  const lngDivisions = Math.pow(2, lngBits)

  const latSize = latRange / latDivisions
  const lngSize = lngRange / lngDivisions

  return {
    latSize,
    lngSize,
    maxSize: Math.max(latSize, lngSize)
  }
}

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
export function calculateGeohashCoverage(bounds: L.LatLngBounds, coverageRatio: number): GeohashCoverage {
  const center = bounds.getCenter()

  // Calculate screen/viewport dimensions
  const mapArea = calculateMapAreaSize(bounds)

  // Start with precision 1 and find optimal level
  let precision = 1

  // Find the right precision level where geohash is appropriately sized
  // We want each geohash to be about coverageRatio times the size of the visible area
  while (precision < 12) {
    const geohashArea = calculateGeohashSize(precision)

    // Stop when geohash is small enough to give reasonable coverage
    // but not so small that we get too many geohashes
    if (geohashArea.maxSize <= mapArea.maxSize * coverageRatio) {
      break
    }
    precision++
  }

  // Generate all geohashes that cover the visible area
  const coveringGeohashes = getAllGeohashesInBounds(bounds, precision)
  const centerGeohash = generateGeohash(center.lat, center.lng, precision)

  return {
    centerGeohash,
    coveringGeohashes,
    precision
  }
}

// Get all geohashes that cover the given bounds at specified precision
function getAllGeohashesInBounds(bounds: L.LatLngBounds, precision: number): string[] {
  const geohashes = new Set<string>()

  // Calculate exact geohash cell dimensions at this precision
  // Each precision level divides the lat/lng ranges by powers of 2
  const latRange = 180.0 // Total latitude range (-90 to 90)
  const lngRange = 360.0 // Total longitude range (-180 to 180)

  // Each geohash character encodes 5 bits: ~2.5 bits lat, ~2.5 bits lng
  // So precision N gives us roughly 2^(2.5*N) divisions in each direction
  const latDivisions = Math.pow(2, Math.floor(precision * 2.5))
  const lngDivisions = Math.pow(2, Math.ceil(precision * 2.5))

  const latStep = latRange / latDivisions
  const lngStep = lngRange / lngDivisions

  // Get bounds
  const north = bounds.getNorth()
  const south = bounds.getSouth()
  const west = bounds.getWest()
  const east = bounds.getEast()

  // Find the grid boundaries that could intersect our bounds
  // Expand to include partial grid cells
  const minLat = Math.floor((south + 90) / latStep) * latStep - 90
  const maxLat = Math.ceil((north + 90) / latStep) * latStep - 90
  const minLng = Math.floor((west + 180) / lngStep) * lngStep - 180
  const maxLng = Math.ceil((east + 180) / lngStep) * lngStep - 180

  // Generate all geohashes in the grid that could intersect
  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lng = minLng; lng <= maxLng; lng += lngStep) {
      // Generate geohash for this grid point
      const geohash = generateGeohash(lat, lng, precision)

      // Decode the geohash to get its exact bounds
      const decoded = decodeGeohash(geohash)
      if (!decoded) continue

      // Check if this geohash cell intersects with our target bounds
      const ghBounds = decoded.bounds
      const intersects = !(
        ghBounds.maxLat < south ||
        ghBounds.minLat > north ||
        ghBounds.maxLng < west ||
        ghBounds.minLng > east
      )

      if (intersects) {
        geohashes.add(geohash)
      }
    }
  }

  // Fallback: if no geohashes found, use corner method
  if (geohashes.size === 0) {
    const corners = [
      generateGeohash(north, west, precision),
      generateGeohash(north, east, precision),
      generateGeohash(south, west, precision),
      generateGeohash(south, east, precision)
    ]
    corners.forEach(gh => geohashes.add(gh))
  }

  return Array.from(geohashes)
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