import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { Card, shuffledDeck } from '../../core/cards';
import { COVERED_BY, PyramidGame, WASTE, deal, isFree, newGame, reduce, solveFirst } from './state';

const c = (t: string): Card => {
  const rank = { A: 1, J: 11, Q: 12, K: 13 }[t.slice(0, -1)] ?? Number(t.slice(0, -1));
  return 'SHDC'.indexOf(t.slice(-1)) * 13 + rank - 1;
};

describe('pyramid', () => {
  it('has 7 rows; a card is free when the two below it are gone', () => {
    expect(COVERED_BY[0]).toEqual([1, 2]);
    expect(COVERED_BY[27]).toEqual([]);
    const g = deal('classic', shuffledDeck(createRng(1)));
    expect(isFree(g, 21)).toBe(true);
    expect(isFree(g, 15)).toBe(false);
  });

  it('removes pairs adding up to 13 and kings alone; undo puts them back', () => {
    let g: PyramidGame = deal('classic', shuffledDeck(createRng(2)));
    g = { ...g, peaks: g.peaks.map((p, i) => (i === 21 ? c('6S') : i === 22 ? c('7H') : i === 23 ? c('KD') : i === 24 ? c('2C') : p)) };
    let ev;
    [g, ev] = reduce(g, { type: 'tap', spot: 21 });
    expect(ev.kind).toBe('selected');
    [g, ev] = reduce(g, { type: 'tap', spot: 24 }); // 6 + 2: just picks the other one
    expect(g.selected).toBe(24);
    [g] = reduce(g, { type: 'tap', spot: 21 });
    [g, ev] = reduce(g, { type: 'tap', spot: 22 }); // 6 + 7
    expect(ev.kind).toBe('removed');
    [g, ev] = reduce(g, { type: 'tap', spot: 23 }); // king
    expect(g.cleared[23]).toBe(true);
    [g] = reduce(g, { type: 'undo' });
    [g] = reduce(g, { type: 'undo' });
    expect(g.cleared.every((x) => !x)).toBe(true);
  });

  it('draws from the stock, three passes in all', () => {
    let g = deal('classic', shuffledDeck(createRng(3)));
    for (let k = 0; k < 24; k++) [g] = reduce(g, { type: 'draw' });
    expect(g.stock).toHaveLength(0);
    [g] = reduce(g, { type: 'draw' });
    expect(g.pass).toBe(2);
    expect(g.stock).toHaveLength(24);
    for (let k = 0; k < 24; k++) [g] = reduce(g, { type: 'draw' });
    [g] = reduce(g, { type: 'draw' });
    for (let k = 0; k < 24; k++) [g] = reduce(g, { type: 'draw' });
    expect(reduce(g, { type: 'draw' })[0]).toBe(g);
  });

  it('pairs a pyramid card with the waste card', () => {
    let g: PyramidGame = deal('classic', shuffledDeck(createRng(4)));
    g = { ...g, waste: [c('4S')], peaks: g.peaks.map((p, i) => (i === 27 ? c('9H') : p)) };
    [g] = reduce(g, { type: 'tap', spot: WASTE });
    const [next, ev] = reduce(g, { type: 'tap', spot: 27 });
    expect(ev.kind).toBe('removed');
    expect(next.waste).toEqual([]);
  });

  it('new deals can be cleared by following the hints', () => {
    let g = newGame('classic', createRng(5));
    for (let k = 0; k < 300 && g.status === 'playing'; k++) {
      const h = solveFirst(g);
      expect(h).not.toBeNull();
      if (h === 'won' || h == null) break;
      if ('draw' in h) [g] = reduce(g, { type: 'draw' });
      else for (const s of h.spots) [g] = reduce(g, { type: 'tap', spot: s });
    }
    expect(g.status).toBe('won');
  });
});
