import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { Card, shuffledDeck } from '../../core/cards';
import { COVERED_BY, TriPeaksGame, adjacent, deal, isFree, isStuck, newGame, reduce, solve } from './state';

const c = (t: string): Card => {
  const rank = { A: 1, J: 11, Q: 12, K: 13 }[t.slice(0, -1)] ?? Number(t.slice(0, -1));
  return 'SHDC'.indexOf(t.slice(-1)) * 13 + rank - 1;
};

describe('layout', () => {
  it('has three peaks over a row of ten', () => {
    expect(COVERED_BY[0]).toEqual([3, 4]);
    expect(COVERED_BY[3]).toEqual([9, 10]);
    expect(COVERED_BY[9]).toEqual([18, 19]);
    expect(COVERED_BY[27]).toEqual([]);
  });

  it('frees a card once both cards over it are gone', () => {
    const g = deal('classic', shuffledDeck(createRng(1)));
    expect(isFree(g, 9)).toBe(false);
    const cleared = g.cleared.slice();
    cleared[18] = cleared[19] = true;
    expect(isFree({ ...g, cleared }, 9)).toBe(true);
  });
});

describe('play', () => {
  it('plays one rank up or down, with king and ace next to each other', () => {
    expect(adjacent(c('KS'), c('AH'))).toBe(true);
    expect(adjacent(c('5S'), c('6S'))).toBe(true);
    expect(adjacent(c('5S'), c('7S'))).toBe(false);
  });

  it('plays, draws and undoes', () => {
    let g: TriPeaksGame = deal('classic', shuffledDeck(createRng(2)));
    g = { ...g, waste: [c('5H')], peaks: g.peaks.map((p, i) => (i === 18 ? c('6S') : i === 19 ? c('9C') : p)) };
    let ev;
    [g, ev] = reduce(g, { type: 'play', i: 19 });
    expect(ev.kind).toBe('invalid');
    [g, ev] = reduce(g, { type: 'play', i: 18 });
    expect(ev.kind).toBe('played');
    expect(g.streak).toBe(1);
    const stock = g.stock.length;
    [g] = reduce(g, { type: 'draw' });
    expect(g.stock).toHaveLength(stock - 1);
    expect(g.streak).toBe(0);
    [g] = reduce(g, { type: 'undo' });
    [g] = reduce(g, { type: 'undo' });
    expect(g.cleared[18]).toBe(false);
    expect(g.waste).toEqual([c('5H')]);
  });

  it('new deals can be cleared by following the solver', () => {
    let g = newGame('classic', createRng(4));
    const path = solve(g)!;
    expect(path).not.toBeNull();
    for (const m of path) [g] = reduce(g, m < 0 ? { type: 'draw' } : { type: 'play', i: m });
    expect(g.status).toBe('won');
  });

  it('is stuck with an empty stock and nothing to play', () => {
    const g = deal('classic', shuffledDeck(createRng(3)));
    const stuck = { ...g, stock: [], waste: [c('5H')], peaks: g.peaks.map(() => c('9S')) };
    expect(isStuck(stuck)).toBe(true);
    expect(isStuck(g)).toBe(false);
  });

  it('is the same deal for the same seed (daily challenge)', () => {
    expect(newGame('daily', createRng(9), '2026-11-12')).toEqual(newGame('daily', createRng(9), '2026-11-12'));
  });
});
