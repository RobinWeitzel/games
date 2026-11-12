import type { Rng } from '../../core/random';
import { Card, rankOf, shuffledDeck } from '../../core/cards';

/**
 * Pyramid solitaire game logic: pure functions only (no storage, no UI), unit-tested in
 * state.test.ts.
 *
 * 28 cards form a pyramid of 7 rows; a card is free when both cards overlapping it from below
 * are gone. Remove two free cards that add up to 13 (jack 11, queen 12; a king, 13, goes
 * alone). The top card of the waste is free too. The stock turns over one card at a time and
 * can be gone through three times. Clear the pyramid to win.
 *
 * The whole PyramidGame object is persisted (games/game/pyramid/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type PyramidMode = 'classic' | 'daily';

export const PEAK = 28;
export const PASSES = 3;
export const UNDO_LIMIT = 500;

/** Row and position of every pyramid card: row r has r + 1 cards. */
export const POS: { row: number; k: number }[] = [];
for (let r = 0; r < 7; r++) for (let k = 0; k <= r; k++) POS.push({ row: r, k });
const at = (row: number, k: number) => (row * (row + 1)) / 2 + k;
/** The two cards overlapping each card from the row below. */
export const COVERED_BY: number[][] = POS.map(({ row, k }) => (row < 6 ? [at(row + 1, k), at(row + 1, k + 1)] : []));

/** A place a card can be picked from: a pyramid index (0–27) or the waste (-1). */
export type Spot = number;
export const WASTE = -1;

export type UndoStep =
  | { t: 'remove'; spots: Spot[]; cards: Card[] }
  | { t: 'draw' }
  | { t: 'recycle' };

export interface PyramidGame {
  mode: PyramidMode;
  date?: string;
  peaks: Card[];
  cleared: boolean[];
  /** Face down; the top is the last element. */
  stock: Card[];
  /** Face up; the top is the last element. */
  waste: Card[];
  /** Times the stock has been gone through (1 at the start). */
  pass: number;
  /** A picked card waiting for its partner. */
  selected: Spot | null;
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  history: UndoStep[];
}

export type Action = { type: 'tap'; spot: Spot } | { type: 'draw' } | { type: 'undo' } | { type: 'hint' };

export type Hint = { spots: Spot[] } | { draw: true } | null;

export type Event =
  | { kind: 'none' }
  | { kind: 'selected'; spot: Spot | null }
  | { kind: 'invalid'; spot: Spot; reason: string }
  | { kind: 'removed'; spots: Spot[]; peak: boolean }
  | { kind: 'drew' }
  | { kind: 'undone' }
  | { kind: 'hint'; hint: Hint }
  | { kind: 'won' };

export const value = (c: Card) => rankOf(c);
export const isFree = (g: { cleared: boolean[] }, i: number) => !g.cleared[i] && COVERED_BY[i].every((j) => g.cleared[j]);
export const clearedCount = (g: PyramidGame) => g.cleared.filter(Boolean).length;
export const progress = (g: PyramidGame) => clearedCount(g) / PEAK;

const cardAt = (g: PyramidGame, s: Spot): Card | undefined => (s === WASTE ? g.waste[g.waste.length - 1] : g.peaks[s]);
const isOpen = (g: PyramidGame, s: Spot) => (s === WASTE ? g.waste.length > 0 : isFree(g, s));

export function deal(mode: PyramidMode, deck: Card[], date?: string): PyramidGame {
  const cards = deck.slice();
  return {
    mode,
    ...(date ? { date } : {}),
    peaks: cards.splice(0, PEAK),
    cleared: new Array(PEAK).fill(false),
    stock: cards,
    waste: [],
    pass: 1,
    selected: null,
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

// ---------- Solver ----------

/**
 * Depth-first search with memory. The stock and waste are the 24 remaining cards in their
 * fixed order: a pointer says how many have been turned over, and removed ones are skipped.
 * Returns the first move of a winning line (spots to remove, or a draw) or null.
 */
export function solveFirst(g: PyramidGame, budget = 60000): Hint | 'won' {
  if (clearedCount(g) === PEAK) return 'won';
  // Rebuild the deck order: waste bottom→top, then the stock top→bottom.
  const deck = [...g.waste, ...g.stock.slice().reverse()];
  const removed = new Array(deck.length).fill(false);
  const cleared = g.cleared.slice();
  let ptr = g.waste.length;
  let pass = g.pass;
  let nodes = 0;
  const seen = new Set<string>();
  let first: Hint = null;
  const wasteTop = () => {
    for (let k = ptr - 1; k >= 0; k--) if (!removed[k]) return k;
    return -1;
  };
  const free = () => {
    const out: number[] = [];
    for (let i = 0; i < PEAK; i++) if (!cleared[i] && COVERED_BY[i].every((j) => cleared[j])) out.push(i);
    return out;
  };
  const rec = (depth: number, left: number): boolean => {
    if (!left) return true;
    if (++nodes > budget) return false;
    let mask = 0;
    for (let i = 0; i < PEAK; i++) if (cleared[i]) mask |= 1 << i;
    let rmask = 0;
    for (let k = 0; k < removed.length; k++) if (removed[k]) rmask |= 1 << k;
    const key = `${mask},${rmask},${ptr},${pass}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const f = free();
    const w = wasteTop();
    const tryRemove = (spots: Spot[], deckIdx: number[]) => {
      for (const s of spots) if (s >= 0) cleared[s] = true;
      for (const d of deckIdx) removed[d] = true;
      const peaks = spots.filter((s) => s >= 0).length;
      const ok = rec(depth + 1, left - peaks);
      for (const s of spots) if (s >= 0) cleared[s] = false;
      for (const d of deckIdx) removed[d] = false;
      if (ok && depth === 0) first = { spots };
      return ok;
    };
    // Kings alone, then pairs in the pyramid, then pairs with the waste card.
    for (const i of f) if (value(g.peaks[i]) === 13 && tryRemove([i], [])) return true;
    if (w >= 0 && value(deck[w]) === 13 && tryRemove([WASTE], [w])) return true;
    for (let a = 0; a < f.length; a++)
      for (let b = a + 1; b < f.length; b++) if (value(g.peaks[f[a]]) + value(g.peaks[f[b]]) === 13 && tryRemove([f[a], f[b]], [])) return true;
    if (w >= 0) for (const i of f) if (value(g.peaks[i]) + value(deck[w]) === 13 && tryRemove([i, WASTE], [w])) return true;
    if (nodes > budget) return false;
    // Turn over the next stock card, or start the next pass.
    let next = ptr;
    while (next < deck.length && removed[next]) next++;
    if (next < deck.length) {
      const save = ptr;
      ptr = next + 1;
      const ok = rec(depth + 1, left);
      ptr = save;
      if (ok && depth === 0) first = { draw: true };
      return ok;
    }
    if (pass < PASSES) {
      const save = ptr;
      ptr = 0;
      pass++;
      const ok = rec(depth + 1, left);
      ptr = save;
      pass--;
      if (ok && depth === 0) first = { draw: true };
      return ok;
    }
    return false;
  };
  return rec(0, PEAK - clearedCount(g)) ? first : null;
}

const MAX_TRIES = 40;

/** A new deal that the solver has cleared, so every game can be won. */
export function newGame(mode: PyramidMode, rng: Rng, date?: string): PyramidGame {
  let g = deal(mode, shuffledDeck(rng), date);
  for (let i = 0; i < MAX_TRIES && !solveFirst(g, 30000); i++) g = deal(mode, shuffledDeck(rng), date);
  return g;
}

// ---------- Reducer ----------

const pushHistory = (h: UndoStep[], s: UndoStep) => [...h, s].slice(-UNDO_LIMIT);

function remove(g: PyramidGame, spots: Spot[]): [PyramidGame, Event] {
  const cleared = g.cleared.slice();
  let waste = g.waste;
  const cards = spots.map((s) => cardAt(g, s)!);
  for (const s of spots) {
    if (s === WASTE) waste = waste.slice(0, -1);
    else cleared[s] = true;
  }
  const next: PyramidGame = { ...g, cleared, waste, selected: null, moves: g.moves + 1, touched: true, history: pushHistory(g.history, { t: 'remove', spots, cards }) };
  if (cleared.every(Boolean)) return [{ ...next, status: 'won' }, { kind: 'won' }];
  return [next, { kind: 'removed', spots, peak: spots.includes(0) }];
}

export const canDraw = (g: PyramidGame) => g.stock.length > 0 || (g.waste.length > 0 && g.pass < PASSES);

export function reduce(g: PyramidGame, action: Action): [PyramidGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'tap': {
      const s = action.spot;
      const card = cardAt(g, s);
      if (card == null || (s >= 0 && g.cleared[s])) return [g, { kind: 'none' }];
      if (!isOpen(g, s)) return [g, { kind: 'invalid', spot: s, reason: 'That card is still covered' }];
      if (value(card) === 13) return remove(g, [s]);
      if (g.selected == null || g.selected === s) {
        const selected = g.selected === s ? null : s;
        return [{ ...g, selected }, { kind: 'selected', spot: selected }];
      }
      const other = cardAt(g, g.selected)!;
      if (value(other) + value(card) !== 13) return [{ ...g, selected: s }, { kind: 'selected', spot: s }];
      return remove(g, [g.selected, s]);
    }
    case 'draw': {
      if (g.stock.length) {
        return [
          { ...g, stock: g.stock.slice(0, -1), waste: [...g.waste, g.stock[g.stock.length - 1]], selected: null, moves: g.moves + 1, touched: true, history: pushHistory(g.history, { t: 'draw' }) },
          { kind: 'drew' },
        ];
      }
      if (g.waste.length && g.pass < PASSES) {
        return [
          { ...g, stock: g.waste.slice().reverse(), waste: [], pass: g.pass + 1, selected: null, moves: g.moves + 1, touched: true, history: pushHistory(g.history, { t: 'recycle' }) },
          { kind: 'drew' },
        ];
      }
      return [g, { kind: 'none' }];
    }
    case 'undo': {
      const step = g.history[g.history.length - 1];
      if (!step) return [g, { kind: 'none' }];
      const base = { ...g, selected: null, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true };
      if (step.t === 'draw') return [{ ...base, stock: [...g.stock, g.waste[g.waste.length - 1]], waste: g.waste.slice(0, -1) }, { kind: 'undone' }];
      if (step.t === 'recycle') return [{ ...base, waste: g.stock.slice().reverse(), stock: [], pass: g.pass - 1 }, { kind: 'undone' }];
      const cleared = g.cleared.slice();
      let waste = g.waste;
      step.spots.forEach((s, k) => {
        if (s === WASTE) waste = [...waste, step.cards[k]];
        else cleared[s] = false;
      });
      return [{ ...base, cleared, waste }, { kind: 'undone' }];
    }
    case 'hint': {
      const h = solveFirst(g, 40000);
      return [{ ...g, hints: g.hints + 1, touched: true, selected: null }, { kind: 'hint', hint: h === 'won' ? null : h }];
    }
  }
}

/** No pair can be removed and the stock can't help any more (only if the solver finds nothing). */
export function isStuck(g: PyramidGame): boolean {
  if (g.status !== 'playing' || canDraw(g)) return false;
  const open: Card[] = [];
  for (let i = 0; i < PEAK; i++) if (isFree(g, i)) open.push(g.peaks[i]);
  if (g.waste.length) open.push(g.waste[g.waste.length - 1]);
  if (open.some((c) => value(c) === 13)) return false;
  return !open.some((a, i) => open.some((b, j) => i < j && value(a) + value(b) === 13));
}
