import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { Card, cardText, shuffledDeck } from '../../core/cards';
import {
  FreeCellGame,
  autoFinishMove,
  bestTarget,
  canAutoFinish,
  canPickUp,
  deal,
  foundationCount,
  hintMove,
  isStuck,
  maxRun,
  newGame,
  reduce,
  solve,
} from './state';

/** Card from text: c('7H') = 7 of hearts. Suits S H D C. */
const c = (t: string): Card => {
  const rank = { A: 1, J: 11, Q: 12, K: 13 }[t.slice(0, -1)] ?? Number(t.slice(0, -1));
  return 'SHDC'.indexOf(t.slice(-1)) * 13 + rank - 1;
};
const cards = (s: string) => (s ? s.split(' ').map(c) : []);

/** A game from columns written bottom first; foundations default to empty. */
function game(cols: string[], opts: Partial<FreeCellGame> = {}): FreeCellGame {
  return {
    ...deal('classic', shuffledDeck(createRng(1))),
    tableau: Array.from({ length: 8 }, (_, i) => cards(cols[i] ?? '')),
    cells: [null, null, null, null],
    foundations: [0, 0, 0, 0],
    ...opts,
  };
}

describe('deal', () => {
  it('deals 52 cards into 7, 7, 7, 7, 6, 6, 6, 6 (minus cards that went home)', () => {
    const g = deal('classic', shuffledDeck(createRng(3)));
    const total = g.tableau.reduce((n, col) => n + col.length, 0) + foundationCount(g);
    expect(total).toBe(52);
    expect(new Set(g.tableau.flat()).size).toBe(g.tableau.flat().length);
  });

  it('is the same deal for the same seed (daily challenge)', () => {
    expect(newGame('daily', createRng(42), '2026-11-11')).toEqual(newGame('daily', createRng(42), '2026-11-11'));
  });

  it('new games can be won by following the solver', () => {
    for (let seed = 1; seed <= 3; seed++) {
      let g = newGame('classic', createRng(seed));
      const path = solve(g);
      expect(path).not.toBeNull();
      for (const m of path!) {
        const [next, ev] = reduce(g, { type: 'move', ...m });
        expect(ev.kind).not.toBe('invalid');
        g = next;
      }
      while (g.status === 'playing') {
        const m = autoFinishMove(g);
        expect(m).not.toBeNull();
        g = reduce(g, { type: 'move', ...m! })[0];
      }
      expect(g.status).toBe('won');
    }
  });
});

describe('moves', () => {
  it('builds down in alternating colours', () => {
    const g = game(['8S', '7H', '7C']);
    expect(reduce(g, { type: 'move', from: 't1', index: 0, to: 't0' })[0].tableau[0].map(cardText)).toEqual(['8♠', '7♥']);
    expect(reduce(g, { type: 'move', from: 't2', index: 0, to: 't0' })[1].kind).toBe('invalid');
  });

  it('moves as many cards at once as free cells and empty columns allow', () => {
    // 4 free cells, no empty column besides the target: 5 cards; with one more empty column: 10.
    const g = game(['KS', 'QH JS 10H 9S 8H 7S', '2C', '2D', '3C', '3D', '4C', '4D']);
    expect(maxRun(g)).toBe(5);
    const r = reduce(g, { type: 'move', from: 't1', index: 0, to: 't0' }); // 6 cards
    expect(r[1].kind).toBe('invalid');
    expect(r[1].kind === 'invalid' && r[1].reason).toMatch(/Only 5 cards/);
    expect(reduce(g, { type: 'move', from: 't1', index: 1, to: 't0' })[1].kind).toBe('invalid'); // J♠ doesn't fit K♠
    const fewer = game(['KS', 'QH JS 10H 9S 8H', '2C', '2D', '3C', '3D', '4C', '4D']);
    expect(reduce(fewer, { type: 'move', from: 't1', index: 0, to: 't0' })[0].tableau[0]).toHaveLength(6);
    // Moving into an empty column, that column doesn't count.
    const empty = game(['', 'QH JS 10H 9S 8H 7S', '2C', '2D', '3C', '3D', '4C', '4D']);
    expect(maxRun(empty, 't0')).toBe(5);
    expect(maxRun(empty)).toBe(10);
  });

  it('only ordered runs can be picked up', () => {
    const g = game(['9S 8H 4C', '9C 8D 7S']);
    expect(canPickUp(g, 't0', 1)).toBe(false);
    expect(canPickUp(g, 't1', 0)).toBe(true);
    expect(reduce(g, { type: 'tap', pile: 't0', index: 1 })[1].kind).toBe('invalid');
  });

  it('a free cell holds one card', () => {
    const g = game(['9S 8H', '5C']);
    const [next] = reduce(g, { type: 'move', from: 't0', index: 1, to: 'c2' });
    expect(next.cells[2]).toBe(c('8H'));
    expect(reduce(next, { type: 'move', from: 't1', index: 0, to: 'c2' })[0].cells.filter((x) => x != null)).toHaveLength(2); // goes to a free one
    expect(reduce(g, { type: 'move', from: 't0', index: 0, to: 'c0' })[1].kind).toBe('invalid');
  });

  it('a tap sends a card home first, then onto a column, then to a free cell', () => {
    const g = game(['5H', '6S', 'KD 9D', 'QC'], { foundations: [0, 4, 0, 0] });
    expect(bestTarget(g, 't0', 0)).toBe('f1');
    const g2 = game(['5H', '6S', 'KD 9D', 'QC']);
    expect(bestTarget(g2, 't0', 0)).toBe('t1');
    expect(bestTarget(g2, 't2', 1)).toBe('t4'); // the first empty column
    const full = game(['5H', '6S', 'KD 9D', 'QC', 'JC', 'JD', '2S', '3S']);
    expect(bestTarget(full, 't2', 1)).toBe('c0');
  });

  it('safe cards go home by themselves after a move, and undo puts them back', () => {
    const g = game(['AS 9H', '10S', '2S']);
    const [next, ev] = reduce(g, { type: 'tap', pile: 't0', index: 1 });
    expect(ev.kind).toBe('moved');
    expect(next.foundations[0]).toBe(2); // A♠ and 2♠
    const [back] = reduce(next, { type: 'undo' });
    expect(back.tableau).toEqual(g.tableau);
    expect(back.foundations).toEqual(g.foundations);
    expect(back.undos).toBe(1);
  });

  it('dropping on any foundation means the card’s own', () => {
    const g = game(['3D'], { foundations: [0, 0, 2, 0] });
    const [next] = reduce(g, { type: 'move', from: 't0', index: 0, to: 'f0' });
    expect(next.foundations[2]).toBe(3);
  });
});

describe('end of the game', () => {
  it('finishes automatically when every column is in order', () => {
    const g = game(['KS QS', 'KH QH JH', 'KD', 'KC QC JC 10C'], { foundations: [11, 10, 12, 9] });
    expect(canAutoFinish(g)).toBe(true);
    let cur = g;
    for (let i = 0; i < 20 && cur.status === 'playing'; i++) cur = reduce(cur, { type: 'move', ...autoFinishMove(cur)! })[0];
    expect(cur.status).toBe('won');
    expect(canAutoFinish(game(['KS 2H 5D']))).toBe(false);
  });

  it('knows when nothing can move', () => {
    // Free cells full, no card fits anywhere, nothing can go home.
    const g = game(['5S', '5C', '7S', '7C', '9S', '9C', 'JS', 'JC'], {
      cells: [c('3H'), c('3D'), c('KS'), c('KC')],
    });
    expect(isStuck(g)).toBe(true);
    expect(hintMove(g)).toBeNull();
    expect(isStuck(game(['5S', '4H']))).toBe(false);
  });

  it('a hint is a legal move', () => {
    const g = newGame('classic', createRng(9));
    const m = hintMove(g)!;
    expect(reduce(g, { type: 'move', ...m })[1].kind).toBe('moved');
  });
});
