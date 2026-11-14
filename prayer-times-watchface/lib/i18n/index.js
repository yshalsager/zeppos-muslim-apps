// The face's languages. Each lib/i18n/<lang>.js has the keys of ar.js (test/verify.mjs checks it);
// the watch reads only the chosen one, from assets/<target>/i18n/<lang>.json (lib/i18n/load.js).
// 'auto' follows the watch's language (getLanguage() from @zos/settings); one the face doesn't
// have falls back to English. Urdu and Persian aren't watch languages, so 'auto' can't pick them.

// Each language's own name (its table's `name`; test/verify.mjs checks), in menu order
export const LANG_NAMES = {
  ar: 'العربية', en: 'English', fr: 'Français', tr: 'Türkçe', id: 'Bahasa Indonesia', ms: 'Bahasa Melayu', ru: 'Русский',
}
export const LANG_CODES = Object.keys(LANG_NAMES)
export const DEFAULT_LANG = 'en'

// getLanguage() codes (Zepp OS API 2.0 language table) → face language
const WATCH_LANGS = { 2: 'en', 4: 'ru', 6: 'fr', 8: 'id', 13: 'ar', 17: 'tr', 31: 'ms' }
export const watchLang = (code) => WATCH_LANGS[code] || DEFAULT_LANG

// setting: 'auto' or a language code; watchCode: getLanguage()'s value (or undefined) → language code
export const resolveLang = (setting, watchCode) => (LANG_NAMES[setting] ? setting : watchLang(watchCode))

// A language file's text (assets/<target>/i18n/<lang>.json, tools/gen-i18n.mjs) → its strings. The
// tables' functions are stored as templates under "$fn": "{0}" is the first argument, "{0.wd}" its wd field.
const fill = (tpl) => (...a) => tpl.replace(/\{(\d)(?:\.(\w+))?\}/g, (_, i, k) => (k ? a[i][k] : a[i]))
export function revive(json) {
  const { $fn, ...T } = JSON.parse(json)
  for (const k in $fn) T[k] = fill($fn[k])
  return T
}
