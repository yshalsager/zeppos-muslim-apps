// The face's own key-value storage, holding JSON values: @zos/storage LocalStorage (needs the
// device:os.local_storage permission; works in a face on the Bip Max), or, where a face has no
// LocalStorage (API 3.5 firmware: "not a function"), one file per key in the face's data folder.
import { LocalStorage } from '@zos/storage'
import { openSync, readSync, writeSync, closeSync, statSync, rmSync, O_RDONLY, O_WRONLY, O_CREAT, O_TRUNC } from '@zos/fs'

let storage // undefined = not tried yet, null = unavailable
const local = () => {
  if (storage === undefined) {
    try {
      storage = new LocalStorage()
    } catch (e) {
      console.log(`LocalStorage unavailable, using files: ${e}`)
      storage = null
    }
  }
  return storage
}

const file = (key) => `store-${key}.json`

// JSON with every non-ASCII character escaped, so one byte per character (no UTF-8 encoder needed)
const ascii = (s) => s.replace(/[\u0080-￿]/g, (c) => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4))

function readFile(key) {
  const st = statSync({ path: file(key) })
  if (!st || !st.size) return null
  const buf = new ArrayBuffer(st.size)
  const fd = openSync({ path: file(key), flag: O_RDONLY })
  try {
    readSync({ fd, buffer: buf })
  } finally {
    closeSync({ fd })
  }
  return String.fromCharCode.apply(null, new Uint8Array(buf))
}

function writeFile(key, s) {
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  const fd = openSync({ path: file(key), flag: O_WRONLY | O_CREAT | O_TRUNC })
  try {
    writeSync({ fd, buffer: bytes.buffer })
  } finally {
    closeSync({ fd })
  }
}

export function readJSON(key, fallback) {
  try {
    const st = local()
    const v = st ? st.getItem(key, null) : readFile(key)
    return v === null || v === undefined ? fallback : JSON.parse(v)
  } catch (e) {
    console.log(`store read ${key} failed: ${e}`)
    return fallback
  }
}

// value null removes the key. Returns false if storage failed.
export function writeJSON(key, value) {
  try {
    const st = local()
    if (st) {
      if (value === null) st.removeItem(key)
      else st.setItem(key, JSON.stringify(value))
    } else if (value === null) {
      if (statSync({ path: file(key) })) rmSync({ path: file(key) })
    } else writeFile(key, ascii(JSON.stringify(value)))
    return true
  } catch (e) {
    console.log(`store write ${key} failed: ${e}`)
    return false
  }
}
