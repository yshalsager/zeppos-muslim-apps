// Every language's table, for Node: the tests, the generators and the docs. The face itself reads
// one language at a time from the JSON files tools/gen-i18n.mjs makes of them (lib/i18n/load.js).
import ar from './ar.js'
import en from './en.js'
import fr from './fr.js'
import tr from './tr.js'
import id from './id.js'
import ms from './ms.js'
import ru from './ru.js'
import { DEFAULT_LANG } from './index.js'

export const LANGS = { ar, en, fr, tr, id, ms, ru }
export const strings = (lang) => LANGS[lang] || LANGS[DEFAULT_LANG]
