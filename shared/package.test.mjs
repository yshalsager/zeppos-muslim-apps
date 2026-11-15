// Checks every mini app's package needs, whatever the app: run from the app's folder
// (`node --test test/*.test.js ../shared/package.test.mjs`, the app's :test task).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const app = JSON.parse(readFileSync('app.json', 'utf8'))

// NOTICE.txt: the store agreement asks for the licences of what the package contains
test('every target ships its icon and license notices', () => {
  for (const t of Object.keys(app.targets)) {
    for (const f of ['icon.png', 'NOTICE.txt']) assert.ok(existsSync(resolve('assets', t, f)), `${t} ${f}`)
  }
})

// Without it the Bip Max reports 390 × 450 inside an app (guide/multiple-devices.md)
test('the Bip Max gets its real screen size', () => {
  if (!app.targets['bip-max']) return
  assert.equal(app.app._pikeCompatibled, 1)
  assert.equal(app.targets['bip-max'].platforms[0].dw, 432)
})
