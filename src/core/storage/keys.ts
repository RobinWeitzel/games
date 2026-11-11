/**
 * Storage key layout (layout version 2). See docs/STORAGE.md.
 *
 *   games/meta                    layout version of everything below
 *   games/app/<name>              app-wide data (e.g. settings)
 *   games/game/<gameId>/<name>    data owned by one game (save, stats, settings, …)
 *   games/cache/<gameId>/<name>   disposable caches: never exported, safe to delete any time
 *   games/backup/<name>           automatic safety copies taken before migrations
 *
 * Keys are a public contract: once released, a key must never be renamed or reused for
 * different data without a migration.
 */
export const ROOT = 'games/';
export const META_KEY = 'games/meta';

const NAME = /^[a-z][a-z0-9-]*$/;

export function assertName(kind: string, name: string): void {
  if (!NAME.test(name)) {
    throw new Error(`Invalid ${kind} "${name}": use lowercase letters, digits and dashes, starting with a letter.`);
  }
}

export function appKey(name: string): string {
  assertName('app key', name);
  return `games/app/${name}`;
}

export function gameKey(gameId: string, name: string): string {
  assertName('game id', gameId);
  assertName('key', name);
  return `games/game/${gameId}/${name}`;
}

export function cacheKey(gameId: string, name: string): string {
  assertName('game id', gameId);
  assertName('cache key', name);
  return `games/cache/${gameId}/${name}`;
}

export const isCacheKey = (k: string) => k.startsWith('games/cache/');
export const isBackupKey = (k: string) => k.startsWith('games/backup/');
/** Keys that hold user data (exported in backups). */
export const isDataKey = (k: string) => k.startsWith(ROOT) && !isCacheKey(k) && !isBackupKey(k);
