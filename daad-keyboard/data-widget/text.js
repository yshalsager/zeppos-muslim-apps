// Pure text helpers, kept free of @zos imports so node can test them.

// Characters DEL's long-press removes: trailing spaces plus the last word.
export const lastWordLength = (text) => {
  const chars = Array.from(text)
  let i = chars.length
  while (i > 0 && chars[i - 1] === ' ') i--
  while (i > 0 && chars[i - 1] !== ' ') i--
  return chars.length - i
}

// English auto-capital: at the start, and after . ! ? followed by a space.
export const atSentenceStart = (text) => /^\s*$|[.!?]\s+$/.test(text)

// A phrase gets a space before it (unless at the start or after one) and a space after it.
export const phraseToInsert = (text, phrase) => (text === '' || text.endsWith(' ') ? '' : ' ') + phrase + ' '

// The end of the text in at most max characters, from a word start where possible. Our field shows
// this instead of letting the firmware clip overflowing text (it cuts the last line). No "…": the
// field lays out left to right, so a leading one lands on the left, after the Arabic it's for.
export const tail = (text, max) => {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  const end = chars.slice(chars.length - max).join('')
  const space = end.indexOf(' ')
  return space >= 0 && space < end.length - 1 ? end.slice(space + 1) : end
}
