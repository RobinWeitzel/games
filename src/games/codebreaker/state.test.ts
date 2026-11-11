import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { CodebreakerGame, newGame, reduce, score } from './state';

describe('codebreaker', () => {
  it('scores exact and partial matches, each code peg once', () => {
    expect(score([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ exact: 4, partial: 0 });
    expect(score([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ exact: 0, partial: 4 });
    expect(score([0, 0, 1, 1], [0, 1, 0, 2])).toEqual({ exact: 1, partial: 2 });
    expect(score([0, 1, 2, 3], [4, 4, 4, 4])).toEqual({ exact: 0, partial: 0 });
    expect(score([1, 1, 2, 2], [1, 1, 1, 1])).toEqual({ exact: 2, partial: 0 });
  });

  const fixed = (): CodebreakerGame => ({ ...newGame('classic', createRng(1)), code: [0, 1, 2, 3] });
  const enter = (g: CodebreakerGame, pegs: number[]) => {
    for (const s of pegs) [g] = reduce(g, { type: 'add', symbol: s });
    return reduce(g, { type: 'submit' });
  };

  it('fills slots, clears them and only submits full guesses', () => {
    let g = fixed();
    [g] = reduce(g, { type: 'add', symbol: 5 });
    [g] = reduce(g, { type: 'add', symbol: 4 });
    expect(g.current).toEqual([5, 4, null, null]);
    expect(reduce(g, { type: 'submit' })[0]).toBe(g);
    [g] = reduce(g, { type: 'clear', slot: 0 });
    [g] = reduce(g, { type: 'add', symbol: 3 });
    expect(g.current).toEqual([3, 4, null, null]);
    [g] = reduce(g, { type: 'backspace' });
    expect(g.current).toEqual([3, null, null, null]);
  });

  it('wins with the code and loses after the last guess', () => {
    const [won, ev] = enter(fixed(), [0, 1, 2, 3]);
    expect(ev.kind).toBe('won');
    expect(won.status).toBe('won');
    let g = fixed();
    let last;
    for (let k = 0; k < 10; k++) [g, last] = enter(g, [5, 5, 5, 5]);
    expect(last!.kind).toBe('lost');
  });

  it('hints reveal pegs that stay in the next rows, but never the whole code', () => {
    let g = fixed();
    [g] = reduce(g, { type: 'hint' });
    expect(g.current).toEqual([0, null, null, null]);
    [g] = enter(g, [5, 5, 5]);
    expect(g.current).toEqual([0, null, null, null]);
    [g] = reduce(g, { type: 'hint' });
    [g] = reduce(g, { type: 'hint' });
    expect(reduce(g, { type: 'hint' })[0]).toBe(g);
    expect(g.hints).toBe(3);
  });

  it('is the same code for the same seed (daily challenge)', () => {
    expect(newGame('daily', createRng(3)).code).toEqual(newGame('daily', createRng(3)).code);
  });
});
