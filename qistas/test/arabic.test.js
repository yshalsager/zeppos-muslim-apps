import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { stub } from '../tools/zos-stub.mjs'
stub.lang = 13
for (const p of ['converter', 'keypad', 'opinions', 'settings', 'units', 'index', 'islamic', 'ingredients', 'recent']) await import(`../page/${p}.js`)
const [converter, keypad, opinions, settings, picker, home, islamic, ingredients, recent] = stub.pages
const visible = () => stub.widgets.filter((w) => w.visible)
const texts = () => visible().map((w) => w.o.text).filter(Boolean)
const open = (p, id) => { stub.widgets = []; if (p.onInit) p.onInit(id); p.build() }
const tap = (value) => {
  const w = visible().find((w) => w.o.text === value)
  assert.ok(w, `missing ${value}`)
  if (w.type === 'BUTTON') return w.o.click_func()
  visible().find((h) => h.type === 'IMG' && h.o.x <= w.o.x && h.o.y <= w.o.y && h.o.y + h.o.h >= w.o.y + w.o.h).listeners.CLICK_UP()
}
beforeEach(() => { stub.store = {}; stub.backed = false })

test('Arabic defaults to Western digits and decimal point in entry and results', () => {
  open(keypad)
  assert.equal(keypad.display.o.text, '1')
  for (const key of ['.', '5']) tap(key)
  assert.equal(keypad.display.o.text, '1.5')
  tap('تم'); assert.ok(stub.backed)
  assert.equal(JSON.parse(stub.store.qistas).pair.value, 1.5)
  open(converter)
  assert.ok(texts().includes('4.92126') && texts().includes('متر'))
})
test('digit setting persists and immediately updates values, keypad, unit labels and home lists', () => {
  stub.store.qistas = JSON.stringify({ pair: { from: 'gold_21', to: 'gold_24', value: 100 } })
  open(settings); tap('أرقام هندية (١٢٣)')
  assert.equal(JSON.parse(stub.store.qistas).settings.arabic_digits, true)
  assert.ok(texts().includes('نصاب الذهب · جرام: ٨٥'))
  open(converter)
  assert.ok(texts().includes('١٠٠') && texts().includes('٨٧٫٥') && texts().includes('جرام عيار ٢١'))
  open(keypad)
  assert.equal(keypad.display.o.text, '١٠٠'); tap('٫'); tap('٥'); tap('تم')
  assert.equal(JSON.parse(stub.store.qistas).pair.value, 100.5)
  open(picker, 'from')
  assert.ok(texts().includes('جرام عيار ٢١'))
  open(home); assert.ok(texts().includes('\u200f١٠٠٫٥ جرام عيار ٢١ إلى جرام عيار ٢٤'))
  tap('الأخيرة'); assert.equal(stub.pushed.url, 'page/recent')
  open(recent); assert.ok(texts().includes('\u200f١٠٠٫٥ جرام عيار ٢١'))
  open(settings); tap('أرقام هندية (١٢٣)')
  open(converter)
  assert.ok(texts().includes('100.5') && texts().includes('جرام عيار 21'))
})
test('Arabic Recent keeps old saved entries and Clear returns to an empty-history home', () => {
  stub.store.qistas = JSON.stringify({ recents: [{ from: 'm', to: 'ft', value: 2 }, { from: 'kg', to: 'lb', value: 1 }] })
  open(home); assert.deepEqual(texts().slice(0, 3), ['قسطاس', 'الأخيرة', '\u200f2 متر إلى قدم'])
  tap('الأخيرة'); open(recent)
  assert.ok(texts().includes('\u200f2 متر') && texts().includes('مسح'))
  tap('مسح'); assert.ok(stub.backed)
  assert.deepEqual(JSON.parse(stub.store.qistas).recents, [])
  open(home); assert.ok(!texts().includes('الأخيرة'))
})
test('Arabic pace entry and seconds validation follow either digit preference', () => {
  for (const arabic_digits of [false, true]) {
    stub.store.qistas = JSON.stringify({ settings: { arabic_digits }, pair: { from: 'pace_km', to: 'pace_mi', value: 5.5 } })
    open(keypad)
    assert.equal(keypad.value, '5:30')
    assert.equal(keypad.display.o.text, arabic_digits ? '٥:٣٠' : '5:30')
    assert.ok(texts().includes(':') && !texts().includes('٫') && !texts().includes('.'))
    keypad.value = '5:60'; keypad.key('OK')
    assert.equal(keypad.title.o.text, arabic_digits ? 'الثواني من ٠ إلى ٥٩' : 'الثواني من 0 إلى 59')
    keypad.value = '5:30'; tap('تم'); open(converter)
    assert.ok(texts().includes(arabic_digits ? '٨:٥١' : '8:51'))
  }
})
test('Arabic short labels and kilogram spelling work in both digit modes', () => {
  for (const arabic_digits of [false, true]) {
    stub.store.qistas = JSON.stringify({ settings: { arabic_digits } })
    open(opinions, 'sa')
    const labels = texts()
    assert.ok(labels.includes(arabic_digits ? '\u200f٢٫٥ كجم · أرز' : '\u200f2.5 كجم · أرز'))
    assert.ok(labels.includes(arabic_digits ? '\u200f٢٫٠٤ كجم · قمح' : '\u200f2.04 كجم · قمح'))
    assert.ok(labels.includes(arabic_digits ? '\u200f٣ كجم · احتياطًا' : '\u200f3 كجم · احتياطًا'))
    assert.ok(!labels.some((s) => /الجبير|عثيمين|باز|إفتاء|الخيرية|كغ/.test(s)))
    assert.ok(labels.every((s) => !/^\u200f[\u0621-\u064a]/.test(s)))
  }
})
test('ingredients and Egyptian units have unambiguous Arabic gram labels', () => {
  stub.store.qistas = JSON.stringify({ pair: { from: 'i_cup', to: 'i_g', value: 1 } })
  open(converter); assert.ok(texts().includes('دقيق') && texts().includes('جرام'))
  tap('دقيق'); open(ingredients); tap('عسل'); open(converter)
  assert.ok(texts().includes('336') && texts().includes('عسل'))
  stub.store.qistas = JSON.stringify({ pair: { from: 'kg', to: 'lb', value: 1 } })
  open(picker, 'to')
  for (const label of ['باوند', 'رطل مصري', 'أقة', 'قنطار مصري', 'جرام']) assert.ok(texts().includes(label))
  assert.ok(!texts().includes('رطل'))
})
test('gold karats are the group default and Islamic coin names remain explicit', () => {
  open(islamic)
  assert.deepEqual(texts(), ['المقادير الشرعية', 'الذهب', 'الفضة', 'الصاع والمدّ', 'المسافات الشرعية'])
  tap('الذهب')
  assert.deepEqual(JSON.parse(stub.store.qistas).pair, { from: 'gold_21', to: 'gold_24', value: 1 })
  open(picker, 'from')
  for (const label of ['جرام', 'مثقال', 'الدينار الشرعي', 'جرام عيار 21']) assert.ok(texts().includes(label))
  assert.ok(!texts().includes('الدرهم الشرعي'))
  open(islamic); tap('الفضة'); open(picker, 'from')
  for (const label of ['جرام', 'الدرهم الشرعي', 'أوقية شرعية', 'مهر السنة']) assert.ok(texts().includes(label))
  assert.ok(!texts().includes('مثقال') && !texts().includes('جرام عيار 21'))
  const s = JSON.parse(stub.store.qistas); s.pair = { from: 'feddan', to: 'sqm', value: 1 }; stub.store.qistas = JSON.stringify(s)
  open(picker, 'from'); assert.ok(texts().includes('قيراط (أرض)'))
})
