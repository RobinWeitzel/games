export { appKey, gameKey, cacheKey } from './keys';
export { defineStore, defineCache, useStore, useOptionalStore, declaredStores, getReadOnlyReason, onReadOnlyChange } from './store';
export type { Store, Cache, StoreOptions } from './store';
export { initStorage, CURRENT_LAYOUT } from './layout';
export { createBackup, restoreBackup } from './backup';

/** Ask the browser not to evict our storage (home screen apps on iOS are usually exempt anyway). */
export function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => {});
}
