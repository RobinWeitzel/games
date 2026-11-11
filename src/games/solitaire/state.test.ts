import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import {
  Card,
  SolitaireGame,
  autoFinishMove,
  bestTarget,
  canAutoFinish,
  cardText,
  deal,
  hintMove,
  isStuck,
  isWinnable,
  newGame,
  reduce,
  shuffledDeck,
} from './state';

/** Card from text: c('7H') = 7 of hearts. Suits S H D C. */
const c = (t: string): Card => {
  const rank = { A: 1, J: 11, Q: 12, K: 13 }[t.slice(0, -1)] ?? Number(t.slice(0, -1));
  return 'SHDC'.indexOf(t.slice(-1)) * 13 + rank - 1;
};

/** A hand-built position (everything else empty). */
function pos(p: Partial<SolitaireGame>): SolitaireGame {
  return {
    ...deal('draw1', shuffledDeck(createRng(1))),
    stock: [],
    waste: [],
    foundations: [0, 0, 0, 0],
    tableau: [[], [], [], [], [], [], []],
    faceDown: [0, 0, 0, 0, 0, 0, 0],
    ...p,
  };
}

const allCards = (g: SolitaireGame) =>
  [...g.stock, ...g.waste, ...g.tableau.flat(), ...g.foundations.flatMap((n, s) => Array.from({ length: n }, (_, k) => s * 13 + k))].sort((a, b) => a - b);

describe('deal', () => {
  it('deals 28 cards to the tableau, one face up per column, 24 to the stock', () => {
    const g = deal('draw3', shuffledDeck(createRng(7)));
    expect(g.tableau.map((col) => col.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(g.faceDown).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(g.stock).toHaveLength(24);
    expect(g.draw).toBe(3);
    expect(allCards(g)).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it('new games are winnable, and the daily deal is the same for a seed', () => {
    const a = newGame('daily', createRng(99), '2026-11-11');
    const b = newGame('daily', createRng(99), '2026-11-11');
    expect(a).toEqual(b);
    expect(a.date).toBe('2026-11-11');
    expect(isWinnable(a)).toBe(true);
  });
});

describe('moves', () => {
  it('a tapped card goes to its foundation first, then onto a column', () => {
    const g = pos({ tableau: [[c('AH')], [c('8S')], [c('7H')], [], [], [], []], faceDown: [0, 0, 0, 0, 0, 0, 0] });
    expect(bestTarget(g, 't0', 0)).toBe('f1');
    expect(bestTarget(g, 't2', 0)).toBe('t1');
    const [next, ev] = reduce(g, { type: 'tap', pile: 't2', index: 0 });
    expect(ev).toMatchObject({ kind: 'moved', to: 't1' });
    expect(next.tableau[1].map(cardText)).toEqual(['8♠', '7♥']);
  });

  it('only kings go to empty columns, and a king at the bottom of a column stays', () => {
    const g = pos({ tableau: [[c('KS')], [c('QH')], [], [], [], [], []] });
    expect(bestTarget(g, 't0', 0)).toBe(null);
    expect(reduce(g, { type: 'move', from: 't1', index: 0, to: 't2' })[1].kind).toBe('invalid');
    expect(reduce(g, { type: 'move', from: 't1', index: 0, to: 't0' })[1].kind).toBe('moved');
  });

  it('moving a run turns over the card left behind, and undo turns it back', () => {
    const g = pos({ tableau: [[c('2C'), c('9D'), c('8C')], [c('10S')], [], [], [], [], []], faceDown: [1, 0, 0, 0, 0, 0, 0] });
    const [moved] = reduce(g, { type: 'tap', pile: 't0', index: 1 });
    expect(moved.tableau[1].map(cardText)).toEqual(['10♠', '9♦', '8♣']);
    expect(moved.faceDown[0]).toBe(0);
    expect(moved.history).toEqual([{ t: 'move', from: 't0', to: 't1', n: 2, flip: true }]);
    const [back, ev] = reduce(moved, { type: 'undo' });
    expect(ev.kind).toBe('undone');
    expect(back.tableau).toEqual(g.tableau);
    expect(back.faceDown).toEqual(g.faceDown);
    expect(back.undos).toBe(1);
  });

  it('face-down cards and the middle of the waste cannot be picked up', () => {
    const g = pos({ tableau: [[c('2C'), c('9D')], [], [], [], [], [], []], faceDown: [1, 0, 0, 0, 0, 0, 0], waste: [c('5S'), c('KD')] });
    expect(reduce(g, { type: 'tap', pile: 't0', index: 0 })[0]).toBe(g);
    expect(reduce(g, { type: 'move', from: 'w', index: 0, to: 't1' })[1].kind).toBe('invalid');
  });

  it('foundation cards can come back down', () => {
    const g = pos({ foundations: [0, 1, 0, 0], tableau: [[c('2S')], [], [], [], [], [], []] });
    const [next] = reduce(g, { type: 'move', from: 'f1', index: 0, to: 't0' });
    expect(next.foundations[1]).toBe(0);
    expect(next.tableau[0].map(cardText)).toEqual(['2♠', 'A♥']);
  });
});

describe('stock', () => {
  it('draws three at a time, turns the waste over, and undoes both', () => {
    const g = pos({ draw: 3, stock: [c('AS'), c('2S'), c('3S'), c('4S')], tableau: [[c('KH')], [], [], [], [], [], []] });
    const [d1] = reduce(g, { type: 'tap', pile: 's', index: 3 });
    expect(d1.waste.map(cardText)).toEqual(['4♠', '3♠', '2♠']);
    const [d2] = reduce(d1, { type: 'tap', pile: 's', index: 0 });
    expect(d2.stock).toEqual([]);
    const [r] = reduce(d2, { type: 'tap', pile: 's', index: -1 });
    expect(r.stock).toEqual(g.stock);
    expect(r.waste).toEqual([]);
    let u = r;
    for (let i = 0; i < 3; i++) u = reduce(u, { type: 'undo' })[0];
    expect(u.stock).toEqual(g.stock);
    expect(u.waste).toEqual([]);
    expect(u.moves).toBe(3);
  });
});

describe('end of the game', () => {
  it('finishes automatically once everything is face up, and wins', () => {
    const tableau: Card[][] = [[], [], [], [], [], [], []];
    // Every suit's king … ace in its own column: all face up, nothing in the stock.
    for (let s = 0; s < 4; s++) for (let r = 13; r >= 1; r--) tableau[s].push(s * 13 + r - 1);
    let g = pos({ tableau });
    expect(canAutoFinish(g)).toBe(true);
    let last = '';
    for (let i = 0; i < 52; i++) {
      const [next, ev] = reduce(g, { type: 'move', ...autoFinishMove(g)! });
      g = next;
      last = ev.kind;
    }
    expect(last).toBe('won');
    expect(g.status).toBe('won');
  });

  it('notices when no move helps any more', () => {
    // Two black kings on top; nothing in the stock fits anywhere.
    const g = pos({ stock: [c('5D'), c('9H')], tableau: [[c('2H'), c('KS')], [c('3D'), c('KC')], [], [], [], [], []], faceDown: [1, 1, 0, 0, 0, 0, 0] });
    expect(isStuck(g)).toBe(false); // a king can go to an empty column and turn over a card
    const blocked = pos({ stock: [c('5C'), c('9C')], tableau: [[c('2H'), c('KS')], [c('3D'), c('KC')], [c('4D')], [c('6S')], [c('10C')], [c('8D')], [c('QS')]], faceDown: [1, 1, 0, 0, 0, 0, 0] });
    expect(hintMove(blocked)).toBe(null);
    expect(isStuck(blocked)).toBe(true);
  });

  it('hints at the stock when only drawing helps', () => {
    const g = pos({ stock: [c('AH'), c('7C')], tableau: [[c('KS')], [], [], [], [], [], []] });
    expect(hintMove(g)).toEqual({ from: 's', index: 1, to: 's' });
    const [, ev] = reduce(g, { type: 'hint' });
    expect(ev).toEqual({ kind: 'hint', move: { from: 's', index: 1, to: 's' } });
  });
});

describe('saved games', () => {
  it('plays on from a literal v1 save (games/game/solitaire/save)', () => {
    const saved = JSON.parse(
      '{"mode":"draw1","draw":1,"stock":[],"waste":[13],"foundations":[0,0,0,0],"tableau":[[38],[],[],[],[],[],[]],"faceDown":[0,0,0,0,0,0,0],"status":"playing","moves":4,"hints":0,"undos":1,"elapsedMs":61000,"touched":true,"history":[{"t":"draw","n":1}]}',
    ) as SolitaireGame;
    const [next, ev] = reduce(saved, { type: 'tap', pile: 'w', index: 0 });
    expect(ev).toMatchObject({ kind: 'moved', to: 'f1' });
    expect(next.moves).toBe(5);
    expect(reduce(next, { type: 'undo' })[0].waste).toEqual([13]);
  });
});
