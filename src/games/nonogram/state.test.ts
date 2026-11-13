import { beforeAll, describe, expect, it, vi } from 'vitest';
import { markStorageReady } from '../../core/storage/store';
import { createRng } from '../../core/random';
import { cluesOf, isLineSolvable } from './solver';
import {
  Action,
  BLANK,
  CROSS,
  FILL,
  NonogramGame,
  SIZES,
  generateSolution,
  hintCell,
  isSolved,
  newGame,
  progress,
  reduce,
  restart,
  satisfiedLines,
  strokeCells,
  strokeValue,
} from './state';
import { abandonSaved, createGame, hasGameToAbandon, startGame } from './session';
import { ngSave, ngStats } from './storage';

const run = (g: NonogramGame, ...actions: Action[]) => actions.reduce((acc, a) => reduce(acc, a, createRng(1))[0], g);
const tap = (g: NonogramGame, cell: number): Action => ({ type: 'paint', cells: [cell], value: strokeValue(g, cell) });

/**
 * A hand-made 3×3 puzzle (a plus sign):
 *   . # .
 *   # # #
 *   . # .
 */
function plus(): NonogramGame {
  const g = newGame('small', createRng(1));
  return { ...g, rows: 3, cols: 3, solution: [0, 1, 0, 1, 1, 1, 0, 1, 0], cells: new Array(9).fill(BLANK) };
}

describe('nonogram generator', () => {
  it('only makes pictures that can be solved line by line', () => {
    for (const size of [5, 10, 15]) {
      const rng = createRng(size);
      for (let i = 0; i < 20; i++) {
        const s = generateSolution(size, rng);
        expect(s.length).toBe(size * size);
        expect(isLineSolvable(cluesOf(s, size, size))).toBe(true);
      }
    }
  });

  it('makes the same daily picture for everyone on a date', () => {
    vi.setSystemTime(new Date(2026, 10, 11, 9));
    const a = createGame('daily');
    vi.setSystemTime(new Date(2026, 10, 11, 21));
    const b = createGame('daily');
    vi.setSystemTime(new Date(2026, 10, 12, 9));
    const c = createGame('daily');
    vi.useRealTimers();
    expect(a).toEqual(b);
    expect(a.date).toBe('2026-11-11');
    expect(a.rows).toBe(SIZES.daily);
    expect(a.solution).not.toEqual(c.solution);
    expect(a.touched).toBe(false);
  });
});

describe('nonogram moves', () => {
  it('fills, crosses and clears cells', () => {
    let g = run(plus(), tap(plus(), 1));
    expect(g.cells[1]).toBe(FILL);
    expect(g.touched).toBe(true);
    g = run(g, tap(g, 1));
    expect(g.cells[1]).toBe(BLANK);
    g = run(g, { type: 'toggleCrossMode' });
    g = run(g, tap(g, 0));
    expect(g.cells[0]).toBe(CROSS);
  });

  it('paints a stroke only over cells in the same state as its first cell', () => {
    let g = run(plus(), { type: 'toggleCrossMode' }, { type: 'paint', cells: [4], value: CROSS }, { type: 'toggleCrossMode' });
    // Fill stroke 3 → 5 skips the cross on 4.
    g = run(g, { type: 'paint', cells: [3, 4, 5], value: strokeValue(g, 3) });
    expect(g.cells.slice(3, 6)).toEqual([FILL, CROSS, FILL]);
    // Erasing from a filled cell only erases fills.
    g = run(g, { type: 'paint', cells: [5, 4, 3], value: strokeValue(g, 5) });
    expect(g.cells.slice(3, 6)).toEqual([BLANK, CROSS, BLANK]);
  });

  it('keeps strokes in the row or column they started in', () => {
    const g = { cols: 5 };
    expect(strokeCells(g, 6, 9, 'row')).toEqual([6, 7, 8, 9]);
    expect(strokeCells(g, 9, 6, 'row')).toEqual([9, 8, 7, 6]);
    expect(strokeCells(g, 1, 21, 'col')).toEqual([1, 6, 11, 16, 21]);
  });

  it('undoes one stroke at a time', () => {
    const g0 = plus();
    const g1 = run(g0, { type: 'paint', cells: [3, 4, 5], value: FILL });
    const g2 = run(g1, tap(g1, 1));
    const back = run(g2, { type: 'undo' });
    expect(back.cells).toEqual(g1.cells);
    expect(run(back, { type: 'undo' }).cells).toEqual(g0.cells);
    expect(run(g0, { type: 'undo' })).toBe(g0);
  });

  it('greys out lines that match their clue', () => {
    const g = run(plus(), { type: 'paint', cells: [3, 4, 5], value: FILL });
    const s = satisfiedLines(g);
    expect(s.rows).toEqual([false, true, false]);
    expect(s.cols).toEqual([true, false, true]); // columns 1 and 3 need a single cell: done
  });

  it('wins when every line matches, and the crosses make way for the picture', () => {
    let g = run(plus(), { type: 'toggleCrossMode' }, { type: 'paint', cells: [0], value: CROSS }, { type: 'toggleCrossMode' });
    g = run(g, { type: 'paint', cells: [3, 4, 5], value: FILL }, { type: 'paint', cells: [1], value: FILL });
    expect(isSolved(g)).toBe(false);
    const [won, ev] = reduce(g, { type: 'paint', cells: [7], value: FILL });
    expect(ev.kind).toBe('won');
    expect(won.status).toBe('won');
    expect(won.cells).toEqual([0, 1, 0, 1, 1, 1, 0, 1, 0]);
    expect(progress(won)).toBe(1);
    expect(reduce(won, tap(won, 0))[0]).toBe(won);
  });
});

describe('nonogram hints', () => {
  it('corrects a wrong mark first', () => {
    const g = run(plus(), { type: 'paint', cells: [0], value: FILL });
    expect(hintCell(g, createRng(1))).toEqual({ cell: 0, fixed: true });
    const [h, ev] = reduce(g, { type: 'hint' }, createRng(1));
    expect(ev).toEqual({ kind: 'hint', cell: 0, fixed: true });
    expect(h.cells[0]).toBe(CROSS);
    expect(h.hints).toBe(1);
  });

  it('marks a cell that follows from one line', () => {
    // On the empty plus, row 2 (3 of 3) and column 2 are fully determined.
    const h = hintCell(plus(), createRng(3))!;
    expect(h.fixed).toBe(false);
    expect([1, 3, 4, 5, 7]).toContain(h.cell);
  });

  it('solves any generated puzzle by hints alone', () => {
    for (const mode of ['small', 'medium', 'large'] as const) {
      let g = newGame(mode, createRng(7));
      for (let i = 0; i < g.cells.length && g.status === 'playing'; i++) g = run(g, { type: 'hint' });
      expect(g.status).toBe('won');
    }
  });
});

describe('nonogram session', () => {
  beforeAll(() => markStorageReady()); // as after initStorage() at launch

  it('counts a touched game as abandoned when a new one starts', () => {
    const g = createGame('small');
    ngSave.set(run(g, tap(g, 0)));
    expect(hasGameToAbandon()).toBe(true);
    startGame('medium');
    expect(ngStats.get('small').played).toBe(1);
    expect(ngStats.get('small').history[0].outcome).toBe('abandoned');
    expect(ngSave.get()?.mode).toBe('medium');
    abandonSaved(); // untouched: not counted
    expect(ngStats.get('medium').played).toBe(0);
    expect(ngSave.get()).toBeNull();
  });

  it('reads a save written by release 1 (literal stored value)', async () => {
    localStorage.setItem(
      'games/game/nonogram/save',
      JSON.stringify({
        v: 1,
        data: {
          mode: 'small',
          rows: 5,
          cols: 5,
          solution: [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1],
          cells: [1, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          crossMode: true,
          history: ['1000000000000000000000000', '1100000000000000000000000'],
          status: 'playing',
          elapsedMs: 4321,
          hints: 1,
          touched: true,
        },
      }),
    );
    // Fresh module, so the store loads from storage like on app launch.
    vi.resetModules();
    (await import('../../core/storage/store')).markStorageReady();
    const { ngSave: fresh } = await import('./storage');
    const g = fresh.get()!;
    expect(g.crossMode).toBe(true);
    expect(g.elapsedMs).toBe(4321);
    expect(run(g, { type: 'undo' }).cells.slice(0, 6)).toEqual([1, 1, 0, 0, 0, 0]);
    expect(run(g, tap(g, 2)).cells[2]).toBe(CROSS);
  });
});

describe('restart', () => {
  it('clears every mark and the undo history, keeping time and hints', () => {
    const g0 = plus();
    expect(restart(g0)).toBe(g0);
    const g = { ...run(g0, tap(g0, 0), { type: 'toggleCrossMode' }, { type: 'paint', cells: [1], value: CROSS }, { type: 'hint' }), elapsedMs: 5000 };
    expect(g.status).toBe('playing');
    const r = restart(g);
    expect(r.cells.every((c) => c === BLANK)).toBe(true);
    expect(r).toMatchObject({ status: 'playing', history: [], hints: 1, elapsedMs: 5000 });
    expect(restart(r)).toBe(r);
  });
});
