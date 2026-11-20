import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)))
test('offline API 3 package has only required permissions', () => {
  assert.equal(app.app.appId, 1136625)
  assert.deepEqual(app.permissions.sort(), ['data:os.device.info', 'device:os.local_storage'])
  assert.equal(app.runtime.apiVersion.minVersion, '3.0.0')
  assert.ok(!existsSync('app-side') && !existsSync('setting'))
})
test('all devices register the complete page set and English and Arabic names', () => {
  for (const t of Object.values(app.targets)) assert.deepEqual(t.module.page.pages, ['page/index', 'page/converter', 'page/keypad', 'page/units', 'page/islamic', 'page/settings', 'page/opinions', 'page/ingredients', 'page/recent'])
  assert.equal(app.i18n['ar-EG'].appName, 'قسطاس')
})
test('committed previews are exactly the README images plus the store icon and screenshots', () => {
  const readmes = ['../README.md', '../../README.md'].map((p) => readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n')
  const shown = new Set([...readmes.matchAll(/docs\/qistas\/([\w-]+\.png)/g)].map((m) => m[1]))
  shown.add('icon.png')
  for (const lang of ['en', 'ar']) for (const shape of ['square', 'round']) shown.add(`${lang}-${shape}.png`) // the store's screenshots
  assert.equal(shown.size, 13)
  assert.deepEqual(readdirSync(new URL('../../docs/qistas/', import.meta.url)).sort(), [...shown].sort())
})
