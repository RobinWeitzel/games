import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { SlideGame, isSolvable, isSolved, newGame, reduce, shuffleTiles } from './state';

const game = (n: number, tiles: number[]): SlideGame => ({ ...newGame('size3', n, createRng(1)), n, tiles });

describe('sliding puzzle', () => {
  it('knows which arrangements can be solved', () => {
    expect(isSolvable([1, 2, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(true);
    expect(isSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
    expect(isSolvable([...Array.from({ length: 15 }, (_, i) => i + 1), 0], 4)).toBe(true);
    // The famous 14-15 swap can't be solved.
    expect(isSolvable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0], 4)).toBe(false);
  });

  it('only deals solvable arrangements', () => {
    for (let s = 1; s <= 20; s++) for (const n of [3, 4, 5]) expect(isSolvable(shuffleTiles(n, createRng(s)), n)).toBe(true);
  });

  it('slides one or several tiles towards the gap, and undo slides them back', () => {
    let g = game(3, [1, 2, 3, 4, 5, 6, 0, 7, 8]);
    let ev;
    [g, ev] = reduce(g, { type: 'tap', cell: 8 });
    expect(ev).toEqual({ kind: 'won' }); // 7 and 8 slid left
    expect(g.tiles).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(g.status).toBe('won');
    g = game(3, [1, 2, 3, 4, 5, 6, 0, 7, 8]);
    [g] = reduce(g, { type: 'tap', cell: 0 }); // same column: 1 and 4 move down
    expect(g.tiles).toEqual([0, 2, 3, 1, 5, 6, 4, 7, 8]);
    expect(g.moves).toBe(2);
    [g] = reduce(g, { type: 'undo' });
    expect(g.tiles).toEqual([1, 2, 3, 4, 5, 6, 0, 7, 8]);
  });

  it('refuses tiles off the gap’s row and column', () => {
    const g = game(3, [1, 2, 3, 4, 5, 6, 0, 7, 8]);
    expect(reduce(g, { type: 'tap', cell: 4 })[1].kind).toBe('invalid');
    expect(isSolved(g.tiles)).toBe(false);
  });

  it('is the same arrangement for the same seed (daily challenge)', () => {
    expect(shuffleTiles(4, createRng(8))).toEqual(shuffleTiles(4, createRng(8)));
  });
});
