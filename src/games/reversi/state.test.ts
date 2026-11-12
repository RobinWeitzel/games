import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { count, legalMoves } from './engine';
import { CPU, YOU, newGame, reduce } from './state';

describe('reversi game', () => {
  it('plays your move and the computer’s, and undo goes back to your turn', () => {
    let g = newGame('medium', YOU);
    let ev;
    [g, ev] = reduce(g, { type: 'place', cell: 0 });
    expect(ev.kind).toBe('invalid');
    [g] = reduce(g, { type: 'place', cell: 19 });
    expect(count(g.board, YOU)).toBe(4);
    expect(g.turn).toBe(CPU);
    [g] = reduce(g, { type: 'cpu', rng: createRng(1) });
    expect(g.turn).toBe(YOU);
    [g] = reduce(g, { type: 'undo' });
    expect(g.board).toEqual(newGame('medium', YOU).board);
    expect(g.undos).toBe(1);
  });

  it('plays a whole game to an end', () => {
    let g = newGame('easy', CPU);
    const rng = createRng(3);
    for (let k = 0; k < 200 && g.status === 'playing'; k++) {
      if (g.turn === CPU) [g] = reduce(g, { type: 'cpu', rng });
      else [g] = reduce(g, { type: 'place', cell: legalMoves(g.board, YOU)[0] });
    }
    expect(g.status).not.toBe('playing');
  });
});
