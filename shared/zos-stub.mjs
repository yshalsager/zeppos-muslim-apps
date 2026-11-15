// The parts of a Node stand-in for @zos/* that every app's stub shares (<app>/tools/zos-stub.mjs):
// widgets that record their properties, and the import hook that serves the app's stub modules.
import { registerHooks } from 'node:module'

// A widget factory that records each widget in stub.widgets (tests may replace that list). Nothing is
// drawn; a GROUP's children (w.createWidget) have positions relative to it.
export function widgets(stub) {
  return function make(type, o, parent = null) {
    const w = {
      type, o: { ...o }, parent, visible: true, listeners: {},
      setProperty(p, v) {
        if (p === 'VISIBLE') this.visible = v
        else if (p === 'TEXT') this.o.text = v
        else if (p === 'COLOR') this.o.color = v
        else if (p === 'MORE') Object.assign(this.o, v)
      },
      getProperty() { return 0 },
      addEventListener(e, fn) { this.listeners[e] = fn },
      createWidget(t, props) { return make(t, props, this) },
    }
    stub.widgets.push(w)
    return w
  }
}

// Sends each `@zos/<name>` import to parts[name] (an object of its exports), and lets the watch code's
// extension-less relative imports ('./text') resolve as zeus does.
export function serve(parts) {
  globalThis.__zos = parts
  const HERE = import.meta.url
  registerHooks({
    resolve(spec, ctx, next) {
      const m = spec.startsWith('@zos/') && spec.slice(5)
      if (m && parts[m]) return { url: `${HERE}?m=${m}`, shortCircuit: true }
      if (spec.startsWith('.') && !/\.\w+$/.test(spec)) return next(spec + '.js', ctx)
      return next(spec, ctx)
    },
    load(url, ctx, next) {
      const m = url.startsWith(HERE + '?m=') && url.slice(HERE.length + 3)
      if (!m) return next(url, ctx)
      const source = `export const { ${Object.keys(parts[m]).join(', ')} } = globalThis.__zos.${m}\n`
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
