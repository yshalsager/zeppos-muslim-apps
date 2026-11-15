// Prints lib/layout.js's boxes for one screen as JSON, for tools/gen-icon.py.
//   node tools/layout-data.mjs WIDTH HEIGHT
import { layout } from '../lib/layout.js'

const [w, h] = process.argv.slice(2).map(Number)
console.log(JSON.stringify(layout(w, h)))
