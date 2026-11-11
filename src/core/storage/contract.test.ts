import { expect, it } from 'vitest';
import { declaredStores } from './store';
import { CURRENT_LAYOUT } from './layout';

// Load every storage declaration in the app: app settings + each game's storage.ts.
import '../settings';
import '../session';
const gameStorage = import.meta.glob('../../games/*/storage.ts', { eager: true });

/**
 * THE STORAGE CONTRACT.
 *
 * This is the list of everything the app persists on players' phones. If this test fails you
 * changed persisted data. That is fine, but only together with a matching migration:
 *
 * - Changed the shape of a value?  Bump its `version` and add a `migrations` entry.
 * - Renamed / moved / split keys?   Add a layout migration and bump CURRENT_LAYOUT.
 * - Added a new key?                Just add it below.
 * - Removed a key?                  Don't. Leave it (data may come back) or migrate it.
 *
 * Then update this list. See docs/STORAGE.md.
 */
const CONTRACT = {
  layout: 2,
  stores: [
    'data  games/app/session               v1',
    'data  games/app/settings              v2',
    'cache games/cache/sudoku/daily-puzzle v1',
    'cache games/cache/sudoku/pool         v1',
    'data  games/game/minesweeper/daily    v1',
    'data  games/game/minesweeper/save     v1',
    'data  games/game/minesweeper/settings v1',
    'data  games/game/minesweeper/stats    v1',
    'data  games/game/numbers/daily        v1',
    'data  games/game/numbers/save         v1',
    'data  games/game/numbers/stats        v1',
    'data  games/game/solitaire/daily      v1',
    'data  games/game/solitaire/save       v1',
    'data  games/game/solitaire/settings   v1',
    'data  games/game/solitaire/stats      v1',
    'data  games/game/sudoku/daily         v1',
    'data  games/game/sudoku/save          v1',
    'data  games/game/sudoku/settings      v2',
    'data  games/game/sudoku/stats         v1',
  ],
};

it('every game keeps its storage in games/<id>/storage.ts', () => {
  expect(Object.keys(gameStorage).length).toBeGreaterThan(0);
});

it('matches the storage contract (see docs/STORAGE.md before changing)', () => {
  const actual = declaredStores().map((s) => `${s.kind.padEnd(5)} ${s.key.padEnd(32)} v${s.version}`);
  const norm = (l: string) => l.replace(/\s+/g, ' ');
  expect({ layout: CURRENT_LAYOUT, stores: actual.map(norm) }).toEqual({ layout: CONTRACT.layout, stores: CONTRACT.stores.map(norm) });
});

it('game data lives under its own namespace', () => {
  for (const s of declaredStores()) {
    expect(s.key).toMatch(/^games\/(app\/[a-z0-9-]+|(game|cache)\/[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*)$/);
  }
});
