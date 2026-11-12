import { appKey, defineStore } from './storage';

/**
 * Games the player pinned to the Favorites group on the home screen, in the order they were
 * added. Ids of games that are no longer in the registry are kept (hide, don't delete): the
 * home screen simply skips them, and they come back if the game does.
 */
export const favoritesStore = defineStore<string[]>({
  key: appKey('favorites'),
  version: 1,
  initial: [],
  normalize: (ids) => (Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []),
});

export function isFavorite(gameId: string): boolean {
  return favoritesStore.get().includes(gameId);
}

export function setFavorite(gameId: string, on: boolean): void {
  const ids = favoritesStore.get().filter((id) => id !== gameId);
  favoritesStore.set(on ? [...ids, gameId] : ids);
}
