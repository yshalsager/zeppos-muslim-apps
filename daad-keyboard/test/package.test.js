import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'))

// getDeviceInfo() throws PERMISSION DENIED without it, and the layout is built from it
test('app.json has the permissions the code relies on', () => {
  for (const p of ['device:os.input.method', 'data:os.device.info', 'device:os.local_storage']) {
    assert.ok(app.permissions.includes(p), p)
  }
})
