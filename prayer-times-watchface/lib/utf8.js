// Decoding for asset files read as bytes (lib/city-data.js); pure, so test/verify.mjs covers it.
// UTF-8 bytes → string (QuickJS on the watch has no TextDecoder).
export function utf8(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++]
    let c
    if (b < 0x80) c = b
    else if (b < 0xe0) c = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f)
    else if (b < 0xf0) c = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
    else {
      c = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
      c -= 0x10000
      s += String.fromCharCode(0xd800 + (c >> 10))
      c = 0xdc00 + (c & 0x3ff)
    }
    s += String.fromCharCode(c)
  }
  return s
}
