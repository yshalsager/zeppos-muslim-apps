// Prints lib/layout.js's boxes for a target (its screen from ../devices.json) as JSON, for tools/render.py.
// Run: node tools/layout-data.mjs <target>
import { readFileSync } from 'node:fs'
import { layout } from '../lib/layout.js'

const devices = JSON.parse(readFileSync(new URL('../../devices.json', import.meta.url), 'utf8'))
const d = devices[process.argv[2]]
if (!d) throw new Error(`unknown target ${process.argv[2]} (devices.json)`)
console.log(JSON.stringify(layout(d.width, d.height)))
