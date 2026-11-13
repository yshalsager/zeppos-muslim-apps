// The face's languages. Each file has the keys of ar.js (test/verify.mjs checks it).
// 'auto' follows the watch's language (getLanguage() from @zos/settings); one the face doesn't
// have falls back to English. Urdu and Persian aren't watch languages, so 'auto' can't pick them.
import ar from './ar.js'
import en from './en.js'
import fr from './fr.js'
import tr from './tr.js'
import id from './id.js'
import ms from './ms.js'
import ru from './ru.js'

export const LANGS = { ar, en, fr, tr, id, ms, ru }
export const LANG_CODES = Object.keys(LANGS) // menu order
export const DEFAULT_LANG = 'en'

// getLanguage() codes (Zepp OS API 2.0 language table) → face language
const WATCH_LANGS = { 2: 'en', 4: 'ru', 6: 'fr', 8: 'id', 13: 'ar', 17: 'tr', 31: 'ms' }
export const watchLang = (code) => WATCH_LANGS[code] || DEFAULT_LANG

// setting: 'auto' or a LANGS key; watchCode: getLanguage()'s value (or undefined) → language code
export const resolveLang = (setting, watchCode) => (LANGS[setting] ? setting : watchLang(watchCode))
