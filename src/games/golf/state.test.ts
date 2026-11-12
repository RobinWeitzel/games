import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { Card, shuffledDeck } from '../../core/cards';
import { GolfGame, adjacent, deal, isStuck, newGame, reduce, solve } from './state';

const c = (t: string): Card => {
  const rank = { A: 1, J: 11, Q: 12, K: 13 }[t.slice(0, -1)] ?? Number(t.slice(0, -1));
  return 'SHDC'.indexOf(t.slice(-1)) * 13 + rank - 1;
};

describe('golf', () => {
  it('plays one rank up or down, never from king to ace', () => {
    expect(adjacent(c('5S'), c('4H'))).toBe(true);
    expect(adjacent(c('KS'), c('AH'))).toBe(false);
  });

  it('builds deals of all 52 cards that can be won', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const g = newGame('classic', createRng(seed));
      expect(new Set([...g.columns.flat(), ...g.stock, ...g.waste]).size).toBe(52);
      expect(g.columns.every((col) => col.length === 5)).toBe(true);
      expect(g.stock).toHaveLength(16);
      const path = solve(g, 500000);
      expect(path).not.toBeNull();
      let cur = g;
      for (const m of path!) [cur] = reduce(cur, m < 0 ? { type: 'draw' } : { type: 'play', col: m });
      expect(cur.status).toBe('won');
    }
  });

  it('plays, draws and undoes', () => {
    let g: GolfGame = deal('classic', shuffledDeck(createRng(2)));
    g = { ...g, waste: [c('5H')], columns: g.columns.map((col, i) => (i === 0 ? [...col.slice(0, 4), c('6S')] : i === 1 ? [...col.slice(0, 4), c('9C')] : col)) };
    expect(reduce(g, { type: 'play', col: 1 })[1].kind).toBe('invalid');
    let ev;
    [g, ev] = reduce(g, { type: 'play', col: 0 });
    expect(ev.kind).toBe('played');
    [g] = reduce(g, { type: 'draw' });
    [g] = reduce(g, { type: 'undo' });
    [g] = reduce(g, { type: 'undo' });
    expect(g.columns[0]).toHaveLength(5);
    expect(g.waste).toEqual([c('5H')]);
  });

  it('is stuck with an empty stock and nothing to play', () => {
    const g = deal('classic', shuffledDeck(createRng(3)));
    expect(isStuck({ ...g, stock: [], waste: [c('5H')], columns: g.columns.map(() => [c('9S')]) })).toBe(true);
  });

  it('is the same deal for the same seed (daily challenge)', () => {
    expect(newGame('daily', createRng(9), '2026-11-12')).toEqual(newGame('daily', createRng(9), '2026-11-12'));
  });
});
