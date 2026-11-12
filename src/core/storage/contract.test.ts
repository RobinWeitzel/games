import { expect, it } from 'vitest';
import { declaredStores } from './store';
import { CURRENT_LAYOUT } from './layout';

// Load every storage declaration in the app: app settings + each game's storage.ts.
import '../settings';
import '../session';
import '../favorites';
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
    'data  games/app/favorites             v1',
    'data  games/app/session               v1',
    'data  games/app/settings              v2',
    'cache games/cache/sudoku/daily-puzzle v1',
    'cache games/cache/sudoku/pool         v1',
    'data  games/game/bridges/daily        v1',
    'data  games/game/bridges/save         v1',
    'data  games/game/bridges/stats        v1',
    'data  games/game/calcudoku/daily      v1',
    'data  games/game/calcudoku/save       v1',
    'data  games/game/calcudoku/stats      v1',
    'data  games/game/codebreaker/daily    v1',
    'data  games/game/codebreaker/save     v1',
    'data  games/game/codebreaker/stats    v1',
    'data  games/game/dots-and-boxes/save  v1',
    'data  games/game/dots-and-boxes/stats v1',
    'data  games/game/four-in-a-row/save   v1',
    'data  games/game/four-in-a-row/stats  v1',
    'data  games/game/freecell/daily       v1',
    'data  games/game/freecell/save        v1',
    'data  games/game/freecell/stats       v1',
    'data  games/game/golf/daily           v1',
    'data  games/game/golf/save            v1',
    'data  games/game/golf/stats           v1',
    'data  games/game/kakuro/daily         v1',
    'data  games/game/kakuro/save          v1',
    'data  games/game/kakuro/stats         v1',
    'data  games/game/killer-sudoku/daily  v1',
    'data  games/game/killer-sudoku/save   v1',
    'data  games/game/killer-sudoku/stats  v1',
    'data  games/game/light-up/daily       v1',
    'data  games/game/light-up/save        v1',
    'data  games/game/light-up/stats       v1',
    'data  games/game/minesweeper/daily    v1',
    'data  games/game/minesweeper/save     v1',
    'data  games/game/minesweeper/settings v1',
    'data  games/game/minesweeper/stats    v1',
    'data  games/game/nonogram/daily       v1',
    'data  games/game/nonogram/save        v1',
    'data  games/game/nonogram/settings    v1',
    'data  games/game/nonogram/stats       v1',
    'data  games/game/numberlink/daily     v1',
    'data  games/game/numberlink/save      v1',
    'data  games/game/numberlink/stats     v1',
    'data  games/game/numbers/daily        v1',
    'data  games/game/numbers/save         v1',
    'data  games/game/numbers/stats        v1',
    'data  games/game/nurikabe/daily       v1',
    'data  games/game/nurikabe/save        v1',
    'data  games/game/nurikabe/stats       v1',
    'data  games/game/peg-solitaire/save   v1',
    'data  games/game/peg-solitaire/stats  v1',
    'data  games/game/pyramid/daily        v1',
    'data  games/game/pyramid/save         v1',
    'data  games/game/pyramid/stats        v1',
    'data  games/game/reversi/save         v1',
    'data  games/game/reversi/stats        v1',
    'data  games/game/sliding-puzzle/daily v1',
    'data  games/game/sliding-puzzle/save  v1',
    'data  games/game/sliding-puzzle/stats v1',
    'data  games/game/slitherlink/daily    v1',
    'data  games/game/slitherlink/save     v1',
    'data  games/game/slitherlink/stats    v1',
    'data  games/game/solitaire/daily      v1',
    'data  games/game/solitaire/save       v1',
    'data  games/game/solitaire/settings   v1',
    'data  games/game/solitaire/stats      v1',
    'data  games/game/spider/daily         v1',
    'data  games/game/spider/save          v1',
    'data  games/game/spider/stats         v1',
    'data  games/game/star-battle/daily    v1',
    'data  games/game/star-battle/save     v1',
    'data  games/game/star-battle/stats    v1',
    'data  games/game/sudoku/daily         v1',
    'data  games/game/sudoku/save          v1',
    'data  games/game/sudoku/settings      v2',
    'data  games/game/sudoku/stats         v1',
    'data  games/game/tripeaks/daily       v1',
    'data  games/game/tripeaks/save        v1',
    'data  games/game/tripeaks/stats       v1',
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
