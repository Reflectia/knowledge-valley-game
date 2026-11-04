import { createStore, get, set } from 'idb-keyval';

import type { KeyValueStore } from './save';

/** IndexedDB-backed storage (database "knowledge-valley", store "save"). */
export function idbStore(): KeyValueStore {
  const store = createStore('knowledge-valley', 'save');
  return {
    get: <T>(key: string) => get<T>(key, store),
    set: (key, value) => set(key, value, store),
  };
}
