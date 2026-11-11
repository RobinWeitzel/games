import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { COLS } from './engine';
import { CPU, YOU, newGame, reduce } from './state';

describe('four in a row game', () => {
  it('alternates you and the computer, and undo takes back both discs', () => {
    let g = newGame('medium', YOU);
    [g] = reduce(g, { type: 'drop', col: 3 });
    expect(g.turn).toBe(CPU);
    expect(reduce(g, { type: 'drop', col: 2 })[0]).toBe(g); // not your turn
    [g] = reduce(g, { type: 'cpu', rng: createRng(1) });
    expect(g.history).toHaveLength(2);
    [g] = reduce(g, { type: 'undo' });
    expect(g.history).toEqual([]);
    expect(g.turn).toBe(YOU);
    expect(g.undos).toBe(1);
  });

  it('wins with four in a row', () => {
    let g = newGame('easy', YOU);
    let ev;
    // You build the bottom row; the board is set up so the computer's discs go elsewhere.
    g = { ...g, board: g.board.map((_, i) => (i === 5 * COLS + 0 || i === 5 * COLS + 1 || i === 5 * COLS + 2 ? YOU : i === 4 * COLS + 0 || i === 4 * COLS + 1 ? CPU : 0)) };
    [g, ev] = reduce(g, { type: 'drop', col: 3 });
    expect(ev.kind).toBe('won');
    expect(g.line).toHaveLength(4);
  });

  it('a full column refuses discs', () => {
    let g = newGame('easy', YOU);
    g = { ...g, board: g.board.map((_, i) => (i % COLS === 0 ? (Math.floor(i / COLS) % 2 ? YOU : CPU) : 0)) };
    expect(reduce(g, { type: 'drop', col: 0 })[1].kind).toBe('invalid');
  });

  it('the computer can start', () => {
    let g = newGame('hard', CPU);
    [g] = reduce(g, { type: 'cpu' });
    expect(g.history).toHaveLength(1);
    expect(g.turn).toBe(YOU);
  });
});
