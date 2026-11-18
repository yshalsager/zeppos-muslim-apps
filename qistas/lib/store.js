import { LocalStorage } from '@zos/storage'
import { parseState, remember } from './state'
const storage = new LocalStorage()
export const load = () => parseState(storage.getItem('qistas', ''))
export const save = (s) => storage.setItem('qistas', JSON.stringify(s))
export function savePair(s) { remember(s); save(s) }
