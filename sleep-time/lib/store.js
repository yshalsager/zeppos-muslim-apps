// Settings on the watch: one JSON string in LocalStorage (permission device:os.local_storage).
import { LocalStorage } from '@zos/storage'
import { parseSettings } from './sleep'

const KEY = 'settings'
const storage = new LocalStorage()
export const load = () => parseSettings(storage.getItem(KEY, ''))
export const save = (s) => storage.setItem(KEY, JSON.stringify(s))
