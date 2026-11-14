import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastWordLength, atSentenceStart, phraseToInsert, tail } from '../data-widget/text.js'

test('DEL long-press removes the last word and trailing spaces', () => {
  assert.equal(lastWordLength(''), 0)
  assert.equal(lastWordLength('سلام'), 4)
  assert.equal(lastWordLength('سلام Bip'), 3)
  assert.equal(lastWordLength('سلام عليكم  '), 7)
  assert.equal(lastWordLength('   '), 3)
})

test('auto-capital at the start and after sentence punctuation', () => {
  assert.equal(atSentenceStart(''), true)
  assert.equal(atSentenceStart('Hi. '), true)
  assert.equal(atSentenceStart('Really? '), true)
  assert.equal(atSentenceStart('Hi.'), false)
  assert.equal(atSentenceStart('Hi '), false)
  assert.equal(atSentenceStart('e.g'), false)
})

test('phrases are spaced from surrounding text', () => {
  assert.equal(phraseToInsert('', 'بسم الله'), 'بسم الله ')
  assert.equal(phraseToInsert('قال ', 'رضي الله عنه'), 'رضي الله عنه ')
  assert.equal(phraseToInsert('النبي', 'ﷺ'), ' ﷺ ')
})

test('the field shows the end of long text, from a word start', () => {
  assert.equal(tail('بارك الله فيك', 20), 'بارك الله فيك')
  assert.equal(tail('بارك الله فيك بارك الله فيك', 14), 'بارك الله فيك')
  assert.equal(tail('بارك الله فيك بارك الله فيك', 12), 'الله فيك')
  assert.equal(tail('abcdefghij', 4), 'ghij') // one long word: cut inside it
  assert.ok(Array.from(tail('ما شاء الله '.repeat(9), 30)).length <= 30)
})
