// Location published by the companion app (../prayer-location-app) via ShareTypedStorage.
// Reader API: TypedStorage(appId, scope) from @zos/share-storage (API_LEVEL 3.0, read-only, no has()).
import { TypedStorage } from '@zos/share-storage'

export const LOCATION_APP_ID = 24847 // appId of prayer-location-app — keep in sync
export const LOCATION_SCOPE = 'prayer-location'

// Returns { lat, lon, updatedAt } — updatedAt is 0 when falling back to the defaults.
export function readLocation(fallbackLat, fallbackLon) {
  try {
    const s = new TypedStorage(LOCATION_APP_ID, LOCATION_SCOPE)
    const updatedAt = s.getInt64('updatedAt', 0)
    if (updatedAt > 0) {
      const lat = s.getDouble('lat', fallbackLat)
      const lon = s.getDouble('lon', fallbackLon)
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon, updatedAt }
    }
  } catch (e) {
    console.log('readLocation failed: ' + e)
  }
  return { lat: fallbackLat, lon: fallbackLon, updatedAt: 0 }
}
