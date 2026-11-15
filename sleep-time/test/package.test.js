import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'))

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
