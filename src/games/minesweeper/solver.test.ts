import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { MinesweeperGame, MinesweeperMode, OPEN, newGame, placeMines, reduce } from './state';
import { isSolvable, provablySafe } from './solver';
import { createGame } from './session';

/** Play a game by logic alone: keep opening cells the solver proves safe. */
function playByLogic(g: MinesweeperGame): MinesweeperGame {
  for (let step = 0; step < 1000 && g.status === 'playing'; step++) {
    const safe = provablySafe(g, g.cells.map((s) => s === OPEN));
    if (!safe.length) break;
    for (const c of safe) {
      expect(g.mines[c]).toBe(0); // never "proves" a mine safe
      g = reduce(g, { type: 'open', cell: c })[0];
    }
  }
  return g;
}

describe('minesweeper solver', () => {
  it('detects a 50/50 that needs a guess', () => {
    // 5×2, one mine top right; after opening the left the last two cells can't be told apart.
    const mines = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    expect(isSolvable({ cols: 5, rows: 2, mines }, 0)).toBe(false);
  });

  it('solves boards that only need logic', () => {
    expect(isSolvable({ cols: 4, rows: 4, mines: new Array(16).fill(0) }, 5)).toBe(true);
    // The mine counter: one mine left and one hidden cell.
    expect(isSolvable({ cols: 3, rows: 1, mines: [0, 0, 1] }, 0)).toBe(true);
  });

  it('only ever proves safe cells safe (random boards and positions)', () => {
    for (let seed = 0; seed < 60; seed++) {
      const rng = createRng(seed);
      const g = newGame((['easy', 'medium', 'hard'] as const)[seed % 3]);
      const start = Math.floor(rng() * g.cells.length);
      // Random layouts, mostly NOT no-guess, so the solver gets stuck in many different states.
      const game = reduce({ ...g, mines: placeMines(g, start, rng) }, { type: 'open', cell: start })[0];
      playByLogic(game);
    }
  });
});

describe('minesweeper boards need no guessing', () => {
  for (const mode of ['easy', 'medium', 'hard'] as MinesweeperMode[]) {
    it(`${mode}: every board is cleared by logic from the first tap`, () => {
      for (let seed = 0; seed < 25; seed++) {
        const rng = createRng(1000 + seed);
        const g = newGame(mode);
        const first = Math.floor(rng() * g.cells.length);
        const started = reduce(g, { type: 'tap', cell: first }, rng)[0];
        expect(playByLogic(started).status).toBe('won');
      }
    });
  }

  it('daily: the board is cleared by logic from its open start area', () => {
    expect(playByLogic(createGame('daily')).status).toBe('won');
  });

  it('a hint opens the next logical step', () => {
    let g = reduce(newGame('hard'), { type: 'tap', cell: 100 }, createRng(5))[0];
    const logical = provablySafe(g, g.cells.map((s) => s === OPEN));
    g = reduce(g, { type: 'hint' }, createRng(6))[0];
    expect(logical.some((c) => g.cells[c] === OPEN)).toBe(true);
  });
});
