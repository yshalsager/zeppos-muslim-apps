// The face's strings for one language, read when it's picked from assets/<target>/i18n/<lang>.json
// (tools/gen-i18n.mjs), so only that language is in memory.
import { readAsset } from '../city-data.js'
import { DEFAULT_LANG, revive } from './index.js'

export function strings(lang) {
  try {
    return revive(readAsset(`i18n/${lang}.json`))
  } catch (e) {
    console.log(`strings ${lang} failed: ${e}`)
    if (lang === DEFAULT_LANG) throw e
    return strings(DEFAULT_LANG)
  }
}
