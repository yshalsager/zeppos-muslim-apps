// node --import ./tools/zos-stub/register.mjs …: resolves every @zos/* import to stub.mjs, so the
// face's real code (watchface/, lib/) runs in Node for the README screenshots.
import { registerHooks } from 'node:module'

const STUB = new URL('./stub.mjs', import.meta.url).href
registerHooks({
  resolve: (spec, ctx, next) => (spec.startsWith('@zos/') ? { url: STUB, shortCircuit: true } : next(spec, ctx)),
})
