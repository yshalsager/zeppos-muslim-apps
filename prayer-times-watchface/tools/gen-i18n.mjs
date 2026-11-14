// Writes assets/<target>/i18n/<lang>.json from lib/i18n/<lang>.js, for lib/i18n/load.js. Each
// function becomes a template: it's called with arguments that print as "{0}", "{1}" and whose
// fields print as "{0.wd}". test/verify.mjs checks the templates give the functions' results.
// Run: node tools/gen-i18n.mjs (via `mise run :gen`).
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { LANGS } from '../lib/i18n/tables.js'

const ROOT = new URL('../', import.meta.url)
const DEVICES = JSON.parse(readFileSync(new URL('devices.json', ROOT), 'utf8'))
const TARGETS = Object.keys(DEVICES).filter((k) => !k.startsWith('/'))

const arg = (i) => new Proxy({}, {
  get: (_, k) => (k === Symbol.toPrimitive ? () => `{${i}}` : `{${i}.${String(k)}}`),
})

for (const [lang, table] of Object.entries(LANGS)) {
  const out = { $fn: {} }
  for (const [k, v] of Object.entries(table)) {
    if (typeof v === 'function') out.$fn[k] = v(...[0, 1, 2, 3].map(arg))
    else out[k] = v
  }
  for (const target of TARGETS) {
    const dir = new URL(`assets/${target}/i18n/`, ROOT)
    mkdirSync(dir, { recursive: true })
    writeFileSync(new URL(`${lang}.json`, dir), JSON.stringify(out) + '\n')
  }
}
