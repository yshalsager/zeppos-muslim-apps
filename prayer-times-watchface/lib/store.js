// The face's own key-value storage (@zos/storage LocalStorage), holding JSON values.
// Works in a watchface on the Bip Max (needs the device:os.local_storage permission).
import { LocalStorage } from '@zos/storage'

let storage = null
const local = () => storage || (storage = new LocalStorage())

export function readJSON(key, fallback) {
  try {
    const v = local().getItem(key, null)
    return v === null || v === undefined ? fallback : JSON.parse(v)
  } catch (e) {
    console.log(`store read ${key} failed: ${e}`)
    return fallback
  }
}

// value null removes the key. Returns false if storage failed.
export function writeJSON(key, value) {
  try {
    if (value === null) local().removeItem(key)
    else local().setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.log(`store write ${key} failed: ${e}`)
    return false
  }
}
