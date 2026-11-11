import { beforeAll, describe, expect, it, vi } from 'vitest';
import { markStorageReady } from '../../core/storage/store';
import { createRng, hashString } from '../../core/random';
import {
  Action,
  BOARDS,
  FLAG,
  HIDDEN,
  MinesweeperGame,
  OPEN,
  count,
  flagCount,
  minesLeft,
  neighbours,
  newDailyGame,
  newGame,
  openCount,
  placeMines,
  progress,
  reduce,
  safeCells,
} from './state';
import { abandonSaved, createGame, hasGameToAbandon, startGame } from './session';
import { msSave, msStats } from './storage';

const rng = () => createRng(42);
const run = (g: MinesweeperGame, ...actions: Action[]) => actions.reduce((acc, a) => reduce(acc, a, rng())[0], g);

/**
 * A hand-made 4×3 board:
 *   * . . .
 *   . . . .
 *   . . . *
 */
function fixed(): MinesweeperGame {
  const g = newGame('easy');
  const mines = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  return { ...g, cols: 4, rows: 3, mineCount: 2, mines, cells: new Array(12).fill(HIDDEN) };
}

describe('minesweeper board', () => {
  it('finds neighbours at corners, edges and inside', () => {
    const g = fixed();
    expect(neighbours(g, 0).sort((a, b) => a - b)).toEqual([1, 4, 5]);
    expect(neighbours(g, 5).length).toBe(8);
    expect(neighbours(g, 7).sort((a, b) => a - b)).toEqual([2, 3, 6, 10, 11]);
  });

  it('counts mines around a cell', () => {
    const g = fixed();
    expect(count(g, 1)).toBe(1);
    expect(count(g, 5)).toBe(1);
    expect(count(g, 6)).toBe(1);
    expect(count(g, 2)).toBe(0);
  });

  it('keeps the first cell and its neighbours free of mines', () => {
    for (const mode of ['easy', 'medium', 'hard'] as const) {
      const g = newGame(mode);
      for (let seed = 0; seed < 20; seed++) {
        const safe = seed * 7 % g.cells.length;
        const mines = placeMines(g, safe, createRng(seed));
        expect(mines.reduce((a, b) => a + b, 0)).toBe(BOARDS[mode].mines);
        for (const c of [safe, ...neighbours(g, safe)]) expect(mines[c]).toBe(0);
      }
    }
  });
});

describe('minesweeper moves', () => {
  it('lays the mines on the first tap, which always opens an area', () => {
    const g = run(newGame('medium'), { type: 'tap', cell: 0 });
    expect(g.mines.length).toBe(g.cells.length);
    expect(g.mines[0]).toBe(0);
    expect(count(g, 0)).toBe(0);
    expect(openCount(g)).toBeGreaterThan(1);
    expect(g.touched).toBe(true);
    expect(g.status).toBe('playing');
  });

  it('flood-fills from a 0 up to the numbers', () => {
    const [g, ev] = reduce(fixed(), { type: 'tap', cell: 3 });
    // 3 is a 0: it opens its neighbours 2, 6, 7 (2 is another 0, so 1, 5 and 6 open too).
    expect(ev.kind).toBe('opened');
    expect(g.cells[3]).toBe(OPEN);
    expect(g.cells[7]).toBe(OPEN);
    expect(g.cells[0]).toBe(HIDDEN);
    expect(g.cells[11]).toBe(HIDDEN);
  });

  it('flags and unflags in flag mode, and by touch and hold in normal mode', () => {
    let g = run(fixed(), { type: 'toggleFlagMode' }, { type: 'tap', cell: 0 });
    expect(g.cells[0]).toBe(FLAG);
    expect(minesLeft(g)).toBe(1);
    g = run(g, { type: 'tap', cell: 0 });
    expect(g.cells[0]).toBe(HIDDEN);
    // Hold in flag mode opens.
    g = run(g, { type: 'alt', cell: 2 });
    expect(g.cells[2]).toBe(OPEN);
    // Hold in normal mode flags.
    g = run(g, { type: 'toggleFlagMode' }, { type: 'alt', cell: 11 });
    expect(g.cells[11]).toBe(FLAG);
    expect(flagCount(g)).toBe(1);
  });

  it('never opens a flagged cell by tapping it', () => {
    const g = run(fixed(), { type: 'alt', cell: 0 }, { type: 'tap', cell: 0 });
    expect(g.cells[0]).toBe(FLAG);
    expect(g.status).toBe('playing');
  });

  it('loses when a mine is opened', () => {
    const [g, ev] = reduce(fixed(), { type: 'tap', cell: 0 });
    expect(ev).toEqual({ kind: 'lost', cell: 0 });
    expect(g.status).toBe('lost');
    expect(g.exploded).toBe(0);
    // Finished games ignore moves.
    expect(reduce(g, { type: 'tap', cell: 5 })[0]).toBe(g);
  });

  it('wins when every safe cell is open, and flags the mines', () => {
    let g = fixed();
    for (const c of [3, 4, 5, 8, 9, 10, 1]) g = run(g, { type: 'tap', cell: c });
    expect(openCount(g)).toBe(safeCells(g));
    expect(g.status).toBe('won');
    expect(g.cells[0]).toBe(FLAG);
    expect(g.cells[11]).toBe(FLAG);
    expect(progress(g)).toBe(1);
  });

  it('chords: tapping a number with matching flags opens its neighbours', () => {
    let g = run(fixed(), { type: 'tap', cell: 1 }); // a 1 (next to mine 0)
    expect(g.cells[1]).toBe(OPEN);
    // Not enough flags: nothing happens.
    expect(reduce(g, { type: 'tap', cell: 1 })[0]).toBe(g);
    g = run(g, { type: 'alt', cell: 0 }, { type: 'tap', cell: 1 });
    for (const c of [2, 4, 5, 6]) expect(g.cells[c]).toBe(OPEN);
  });

  it('chording with a wrong flag opens the mine', () => {
    const g = run(fixed(), { type: 'tap', cell: 5 }, { type: 'alt', cell: 4 }, { type: 'tap', cell: 5 });
    expect(g.status).toBe('lost');
    expect(g.exploded).toBe(0);
  });

  it('hints open a safe cell and are counted', () => {
    let g = run(fixed(), { type: 'tap', cell: 3 });
    const before = openCount(g);
    g = run(g, { type: 'hint' });
    expect(g.hints).toBe(1);
    expect(openCount(g)).toBeGreaterThan(before);
    expect(g.status).not.toBe('lost');
  });

  it('a hint clears a wrong flag on the cell it opens', () => {
    // Flag every safe hidden cell: the hint must pick one of them.
    let g = run(fixed(), { type: 'tap', cell: 3 });
    for (let c = 0; c < 12; c++) if (g.cells[c] === HIDDEN && !g.mines[c]) g = run(g, { type: 'alt', cell: c });
    g = run(g, { type: 'hint' });
    expect(g.hints).toBe(1);
    expect(g.status).not.toBe('lost');
  });

  it('a hint before the first move opens the middle of the board', () => {
    const g = run(newGame('easy'), { type: 'hint' });
    expect(g.hints).toBe(1);
    expect(openCount(g)).toBeGreaterThan(0);
    expect(g.status).toBe('playing');
  });
});

describe('minesweeper daily', () => {
  it('is the same board, already opened, for everyone on a date', () => {
    const a = newDailyGame('2026-11-11', createRng(hashString('minesweeper:2026-11-11')));
    const b = newDailyGame('2026-11-11', createRng(hashString('minesweeper:2026-11-11')));
    const c = newDailyGame('2026-11-12', createRng(hashString('minesweeper:2026-11-12')));
    expect(a).toEqual(b);
    expect(a.mines).not.toEqual(c.mines);
    expect(a.mode).toBe('daily');
    expect(a.date).toBe('2026-11-11');
    expect(openCount(a)).toBeGreaterThan(1);
  });

  it('starts untouched, so opening it and leaving is not an abandoned game', () => {
    const g = createGame('daily');
    expect(g.touched).toBe(false);
    expect(g.mines.length).toBe(g.cells.length);
  });
});

describe('minesweeper session', () => {
  beforeAll(() => markStorageReady()); // as after initStorage() at launch

  it('counts a touched game as abandoned when a new one starts', () => {
    msSave.set(run(newGame('easy'), { type: 'tap', cell: 0 }));
    expect(hasGameToAbandon()).toBe(true);
    startGame('hard');
    expect(msStats.get('easy').played).toBe(1);
    expect(msStats.get('easy').history[0].outcome).toBe('abandoned');
    expect(msSave.get()?.mode).toBe('hard');
    abandonSaved(); // untouched: not counted
    expect(msStats.get('hard').played).toBe(0);
    expect(msSave.get()).toBeNull();
  });

  it('reads a save written by release 1 (literal stored value)', async () => {
    localStorage.setItem(
      'games/game/minesweeper/save',
      JSON.stringify({
        v: 1,
        data: {
          mode: 'easy',
          cols: 8,
          rows: 10,
          mineCount: 10,
          mines: [],
          cells: new Array(80).fill(0),
          status: 'playing',
          flagMode: true,
          exploded: null,
          elapsedMs: 1234,
          hints: 0,
          touched: false,
        },
      }),
    );
    // Fresh module, so the store loads from storage like on app launch.
    vi.resetModules();
    (await import('../../core/storage/store')).markStorageReady();
    const { msSave: fresh } = await import('./storage');
    const g = fresh.get()!;
    expect(g.flagMode).toBe(true);
    expect(g.elapsedMs).toBe(1234);
    expect(run(g, { type: 'alt', cell: 0 }).cells[0]).toBe(OPEN);
  });
});
