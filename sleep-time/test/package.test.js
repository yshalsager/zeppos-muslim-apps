import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'))

test('every target ships its icon and license notices', () => {
  for (const t of Object.keys(app.targets)) {
    assert.ok(existsSync(new URL(`../assets/${t}/icon.png`, import.meta.url)), `${t} icon`)
    assert.ok(existsSync(new URL(`../assets/${t}/NOTICE.txt`, import.meta.url)), `${t} NOTICE.txt`)
  }
})

// getDeviceInfo() throws PERMISSION DENIED without the first; settings need the second, alarms the third
test('app.json has the permissions the code relies on, and no others', () => {
  assert.deepEqual([...app.permissions].sort(), ['data:os.device.info', 'device:os.alarm', 'device:os.local_storage'])
})

// The alarm timers open these by path (lib/alarms.js), on every screen
test('every target registers every page', () => {
  for (const [name, t] of Object.entries(app.targets)) {
    assert.deepEqual(t.module.page.pages, ['page/index', 'page/settings', 'page/alarm', 'page/ring', 'page/remind'], name)
  }
})

// Without it the Bip Max reports 390 × 450 inside an app (guide/multiple-devices.md)
test('the Bip Max gets its real screen size', () => {
  assert.equal(app.app._pikeCompatibled, 1)
  assert.equal(app.targets['bip-max'].platforms[0].dw, 432)
})
