import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { Card, cardText, rankOf, suitOf } from '../../core/cards';
import { SpiderGame, bestTarget, canPickUp, deal, hint, isStuck, newGame, reduce, spiderDeck, usefulMoves } from './state';

/** Card from text: c('7H') = 7 of hearts. Suits S H D C. `copy` makes a second card of the same face. */
const c = (t: string, copy = 0): Card => {
  const rank = { A: 1, J: 11, Q: 12, K: 13 }[t.slice(0, -1)] ?? Number(t.slice(0, -1));
  return copy * 52 + 'SHDC'.indexOf(t.slice(-1)) * 13 + rank - 1;
};
const cards = (s: string) => (s ? s.split(' ').map((t) => c(t)) : []);

/** A game from columns written bottom first (all face up unless `faceDown` is given). */
function game(cols: string[], opts: Partial<SpiderGame> = {}): SpiderGame {
  const tableau = Array.from({ length: 10 }, (_, i) => cards(cols[i] ?? ''));
  return { ...deal('suit4', spiderDeck(4)), tableau, faceDown: tableau.map(() => 0), stock: [], done: [], ...opts };
}

describe('deal', () => {
  it('has 104 different cards with 1, 2 or 4 suits', () => {
    for (const [suits, expected] of [[1, [0]], [2, [0, 1]], [4, [0, 1, 2, 3]]] as const) {
      const deck = spiderDeck(suits);
      expect(deck).toHaveLength(104);
      expect(new Set(deck).size).toBe(104);
      expect([...new Set(deck.map(suitOf))].sort()).toEqual(expected);
      expect(deck.filter((x) => rankOf(x) === 13)).toHaveLength(8);
    }
  });

  it('deals 54 cards (6, 6, 6, 6, then 5s) with only the top ones face up, 50 in the stock', () => {
    const g = newGame('suit2', createRng(5));
    expect(g.tableau.map((col) => col.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(g.faceDown).toEqual([5, 5, 5, 5, 4, 4, 4, 4, 4, 4]);
    expect(g.stock).toHaveLength(50);
  });
});

describe('moves', () => {
  it('any card goes onto one rank higher, but only one-suit runs move together', () => {
    const g = game(['9S', '8H', '8S 7S', '8D 7S']);
    expect(reduce(g, { type: 'move', from: 't1', index: 0, to: 't0' })[0].tableau[0].map(cardText)).toEqual(['9♠', '8♥']);
    expect(canPickUp(g, 't2', 0)).toBe(true);
    expect(canPickUp(g, 't3', 0)).toBe(false);
    expect(reduce(g, { type: 'move', from: 't3', index: 0, to: 't0' })[1].kind).toBe('invalid');
  });

  it('turns over the card left on top, and undo turns it back', () => {
    const g = game(['KS 5D', '6D'], { faceDown: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    const [next] = reduce(g, { type: 'tap', pile: 't0', index: 1 });
    expect(next.tableau[1].map(cardText)).toEqual(['6♦', '5♦']);
    expect(next.faceDown[0]).toBe(0);
    const [back] = reduce(next, { type: 'undo' });
    expect(back.tableau).toEqual(g.tableau);
    expect(back.faceDown).toEqual(g.faceDown);
  });

  it('a tap prefers a card of the same suit', () => {
    const g = game(['5S', '6H', '6S', '']);
    expect(bestTarget(g, 't0', 0)).toBe('t2');
    expect(bestTarget(game(['5S', '6H', '', '']), 't0', 0)).toBe('t1');
    expect(bestTarget(game(['5S', '', '7D']), 't0', 0)).toBeNull(); // already at the bottom: no empty column
  });

  it('takes a complete run off the table, and undo puts it back', () => {
    const run = 'KS QS JS 10S 9S 8S 7S 6S 5S 4S 3S 2S';
    const g = game([`9H ${run}`, 'AS'], { faceDown: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    const [next, ev] = reduce(g, { type: 'move', from: 't1', index: 0, to: 't0' });
    expect(ev).toMatchObject({ kind: 'moved', completed: 1 });
    expect(next.done).toHaveLength(1);
    expect(next.tableau[0].map(cardText)).toEqual(['9♥']);
    expect(next.faceDown[0]).toBe(0);
    const [back] = reduce(next, { type: 'undo' });
    expect(back.tableau).toEqual(g.tableau);
    expect(back.faceDown).toEqual(g.faceDown);
    expect(back.done).toEqual([]);
  });

  it('wins with the eighth run', () => {
    const run = 'KS QS JS 10S 9S 8S 7S 6S 5S 4S 3S 2S';
    const g = game([run, 'AS'], { done: Array.from({ length: 7 }, () => []) });
    expect(reduce(g, { type: 'tap', pile: 't1', index: 0 })[1].kind).toBe('won');
  });
});

describe('dealing', () => {
  it('deals one card onto every column, not with an empty column, and undo takes them back', () => {
    const g = newGame('suit1', createRng(2));
    const [next, ev] = reduce(g, { type: 'tap', pile: 's', index: 49 });
    expect(ev.kind).toBe('dealt');
    expect(next.stock).toHaveLength(40);
    expect(next.tableau.map((col) => col.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6, 6, 6]);
    expect(reduce(next, { type: 'undo' })[0]).toMatchObject({ tableau: g.tableau, stock: g.stock });

    const empty = game(['5S', ''], { stock: cards('2S 3S 4S 5S 6S 7S 8S 9S 10S JS') });
    const [, ev2] = reduce(empty, { type: 'deal' });
    expect(ev2.kind === 'invalid' && ev2.reason).toMatch(/empty column/);
  });
});

describe('hints', () => {
  it('prefers turning over a card, and suggests dealing when nothing else helps', () => {
    const g = game(['KH 5D', '6D', '6S'], { faceDown: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(usefulMoves(g)[0]).toEqual({ from: 't0', index: 1, to: 't1' });
    const full = game(['KS 3D', 'KH 3C', 'KD 3S', 'KC 3H', 'QS 9D', 'QH 9C', 'QD 9S', 'QC 9H', 'JS 6D', 'JH 6C'], { stock: cards('2S 3S 4S 5S 6S 7S 8S 9S 10S JS') });
    expect(hint(full).move?.from).toBe('s');
  });

  it('never suggests moving a run back and forth', () => {
    // Q♠ alone in a column: putting it on K♠ only empties the column, which nothing could use.
    const g = game(['KS', 'QS', '3D', '3C', '3S', '3H', '9D', '9C', '9S', '6D']);
    expect(usefulMoves(g)).toEqual([]);
    // With a card to turn over, emptying the column is worth it.
    const withDown = game(['KS', 'QS', '3D 5H', '3C'], { faceDown: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0] });
    expect(usefulMoves(withDown)).toContainEqual({ from: 't1', index: 0, to: 't0' });
  });

  it('is stuck when the stock is used up and nothing makes progress', () => {
    // Cards left in the stock: never stuck.
    const g = game(['KS 3D', 'KH 3C', 'KD 3S', 'KC 3H', 'QS 9D', 'QH 9C', 'QD 9S', 'QC 9H', 'JS 6D', 'JH 6C'], { stock: cards('2S 3S 4S 5S 6S 7S 8S 9S 10S JS') });
    expect(isStuck(g)).toBe(false);
    const stuck = game(['KS 3D', 'KH 3C', 'KD 3S', 'KC 3H', 'QS 9D', 'QH 9C', 'QD 9S', 'QC 9H', 'JS 6D', 'JH 6C']);
    expect(isStuck(stuck)).toBe(true);
    expect(hint(stuck).move).toBeNull();
  });
});
