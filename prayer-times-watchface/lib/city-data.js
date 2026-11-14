// City list for the face menu, read on demand from asset files written by tools/gen-cities.py
// (GeoNames, CC-BY 4.0). Nothing is loaded until the menu opens the location screens.
//
// assets/<target>/cities/index.json: { langs: [lang, ...],
//   groups: [[groupKey, [[cc, nameInLangs[0], nameInLangs[1], ...], ...]], ...] }
//   groupKey names a lib/i18n menu.groups entry; country names come from CLDR (Arabic: GeoNames).
// assets/<target>/cities/<CC>.json:   { cities: [[name, lat, lon, latin?], ...] }
//   or, for long lists, { regions: [[regionName, [[name, lat, lon, latin?], ...], latin?], ...] }
//   name is Arabic, latin the ASCII name when it differs; lat/lon are whole hundredths of a degree.
import { readFileSync, openAssetsSync, statAssetsSync, readSync, closeSync, O_RDONLY } from '@zos/fs'
import { utf8 } from './utf8.js'

const DIR = 'cities/'

// Text of a file in the face's /assets. API 3.0 path form first, then the 2.0 asset calls.
export function readAsset(path) {
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

let index = { lang: null, groups: null } // groups with one language's country names
let country = { cc: null, data: null } // last country read

// → [[groupKey, [[cc, countryName in lang], ...]], ...] (English names when the file lacks lang),
// or null if the files can't be read. Only that language's names are kept in memory.
export function cityGroups(lang) {
  if (index.lang === lang) return index.groups
  try {
    const { langs, groups } = JSON.parse(readAsset(DIR + 'index.json'))
    const i = 1 + (langs.indexOf(lang) < 0 ? langs.indexOf('en') : langs.indexOf(lang))
    index = { lang, groups: groups.map(([key, rows]) => [key, rows.map((row) => [row[0], row[i]])]) }
    return index.groups
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

// A city (or region) row's name: Arabic for right-to-left, else the Latin name.
export const cityName = (row, rtl) => (rtl ? row[0] : row[3] || row[0])
