import { serve, widgets } from '../../shared/zos-stub.mjs'
export const stub = { widgets: [], width: 432, height: 514, lang: 2, store: {}, pages: [], pushed: null, backed: false }
const names = new Proxy({}, { get: (_, k) => k })
serve({
  ui: { createWidget: widgets(stub), deleteWidget(w) { w.visible = false }, setStatusBarVisible() {}, widget: names, prop: names, align: names, text_style: names, event: names },
  page: { SCROLL_MODE_FREE: 'FREE', setScrollMode(o) { stub.scroll_mode = o.mode } },
  router: { push(o) { stub.pushed = o }, back() { stub.backed = true } },
  device: { getDeviceInfo: () => ({ width: stub.width, height: stub.height }) },
  settings: { getLanguage: () => stub.lang },
  storage: { LocalStorage: class { getItem(k) { return stub.store[k] || '' } setItem(k, v) { stub.store[k] = v } } },
})
globalThis.Page = (page) => stub.pages.push(page)
globalThis.setTimeout = (fn) => { fn(); return 0 }
