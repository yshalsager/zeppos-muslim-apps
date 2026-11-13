// Where the face's location comes from, newest first:
//  1. a city picked on the face (settings menu → الموقع), kept in the face's own storage
//  2. the location published by the companion app (../prayer-location-app) via ShareTypedStorage
//  3. the config.js fallback (Cairo)
// Reader API for 2: TypedStorage(appId, scope) from @zos/share-storage (API_LEVEL 3.0, read-only, no has()).
import { TypedStorage } from '@zos/share-storage'
import { readJSON, writeJSON } from './store.js'

export const LOCATION_APP_ID = 24847 // appId of prayer-location-app — keep in sync
export const LOCATION_SCOPE = 'prayer-location'
const CITY_KEY = 'city' // { name, lat, lon, cc, updatedAt }

const valid = (lat, lon) => typeof lat === 'number' && typeof lon === 'number' &&
  Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)

function companionFix() {
  try {
    const s = new TypedStorage(LOCATION_APP_ID, LOCATION_SCOPE)
    const updatedAt = s.getInt64('updatedAt', 0)
    if (updatedAt > 0) {
      const lat = s.getDouble('lat', 0)
      const lon = s.getDouble('lon', 0)
      if (valid(lat, lon)) return { lat, lon, updatedAt, source: 'companion' }
    }
  } catch (e) {
    console.log('companion location failed: ' + e)
  }
  return null
}

// The picked city only changes through saveCity(), so it's read from storage once per face load
// (readLocation runs on every wake).
let city // undefined = not read yet, null = none

function pickedCity() {
  if (city === undefined) {
    const c = readJSON(CITY_KEY, null)
    city = c && valid(c.lat, c.lon) && c.updatedAt > 0 ? { ...c, source: 'city' } : null
  }
  return city
}

// Saves a city picked on the face (name null clears it); cc is its country code. Returns false if
// storage failed.
export function saveCity(name, lat, lon, cc) {
  if (name !== null && !valid(lat, lon)) return false
  const c = name === null ? null : { name, lat, lon, cc, updatedAt: Date.now() }
  if (!writeJSON(CITY_KEY, c)) return false
  city = c && { ...c, source: 'city' }
  return true
}

// Returns { lat, lon, cc, updatedAt, source, name? } — updatedAt is 0 (source 'fallback') for the
// defaults. cc (for the automatic method) is the picked city's country; the companion's GPS fix has
// none, so it keeps the last picked city's country, else the fallback's.
export function readLocation(fallback) {
  const a = pickedCity()
  const b = companionFix()
  const best = a && b ? (a.updatedAt >= b.updatedAt ? a : b) : a || b
  const loc = best || { lat: fallback.lat, lon: fallback.lon, updatedAt: 0, source: 'fallback' }
  return { ...loc, cc: (a && a.cc) || fallback.country }
}
