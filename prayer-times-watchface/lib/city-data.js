// City list for the face menu, read on demand from asset files written by tools/gen-cities.py
// (GeoNames, CC-BY 4.0). Nothing is loaded until the menu opens the location screens.
//
// assets/bip-max/cities/index.json: { groups: [[groupName, [[cc, countryName], ...]], ...] }
// assets/bip-max/cities/<CC>.json:   { cities: [[name, lat, lon], ...] }
//   or, for long lists, { regions: [[regionName, [[name, lat, lon], ...]], ...] }
//   lat/lon are whole hundredths of a degree (smaller files).
import { readFileSync, openAssetsSync, statAssetsSync, readSync, closeSync, O_RDONLY } from '@zos/fs'
import { utf8 } from './utf8.js'

const DIR = 'cities/'

// Text of a file in the face's /assets. API 3.0 path form first, then the 2.0 asset calls.
function readAsset(path) {
  try {
    const s = readFileSync({ path: 'assets://' + path, options: { encoding: 'utf8' } })
    if (typeof s === 'string' && s.length) return s
  } catch (e) {
    console.log(`readFileSync ${path}: ${e}`)
  }
  const st = statAssetsSync({ path })
  if (!st || !st.size) throw new Error('missing ' + path)
  const buf = new ArrayBuffer(st.size)
  const fd = openAssetsSync({ path, flag: O_RDONLY })
  try {
    readSync({ fd, buffer: buf })
  } finally {
    closeSync({ fd })
  }
  return utf8(new Uint8Array(buf))
}

let index = null
let country = { cc: null, data: null } // last country read

// → [[groupName, [[cc, countryName], ...]], ...] or null if the files can't be read.
export function cityGroups() {
  try {
    if (!index) index = JSON.parse(readAsset(DIR + 'index.json')).groups
    return index
  } catch (e) {
    console.log('city index failed: ' + e)
    return null
  }
}

// → { cities } or { regions } for one country (see above), or null.
export function countryCities(cc) {
  if (country.cc === cc) return country.data
  try {
    country = { cc, data: JSON.parse(readAsset(`${DIR}${cc}.json`)) }
    return country.data
  } catch (e) {
    console.log(`cities ${cc} failed: ${e}`)
    return null
  }
}
