import type { Rng } from '../../core/random';
import { Card, rankOf, shuffleCards, suitOf } from '../../core/cards';

/**
 * Spider game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole SpiderGame object is persisted (games/game/spider/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

/** 'daily': a 1 Suit deal, the same for everyone on a date. */
export type SpiderMode = 'suit1' | 'suit2' | 'suit4' | 'daily';

export const COLUMNS = 10;
/** Complete runs (king down to ace of one suit) needed to win. */
export const RUNS = 8;

/** A pile: column 't0'…'t9', or the stock 's'. */
export type Pile = `t${number}` | 's';

/** One undoable step, stored so it can be reversed exactly. */
export type UndoStep =
  /** `n` cards went from column `from` to `to`; `flip`: the card under them was turned face up. */
  | { t: 'move'; from: number; to: number; n: number; flip: boolean; done: Completion[] }
  /** One card was dealt from the stock onto every column. */
  | { t: 'deal'; done: Completion[] };

/** A complete run left column `col` (the last entry of `done`); `flip`: the card under it was turned over. */
export interface Completion {
  col: number;
  flip: boolean;
}

export interface SpiderGame {
  mode: SpiderMode;
  /** The daily challenge's date (YYYY-MM-DD). */
  date?: string;
  /** Ten columns, bottom first. */
  tableau: Card[][];
  /** How many cards at the bottom of each column are face down. */
  faceDown: number[];
  /** Face down; dealt ten at a time from the end. */
  stock: Card[];
  /** Complete runs taken off the table, each king first. */
  done: Card[][];
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  /** The player made a move (an untouched game isn't counted when abandoned). */
  touched: boolean;
  /** Most recent last, capped at UNDO_LIMIT. */
  history: UndoStep[];
}

export const UNDO_LIMIT = 500;

/** A move: the cards from `index` up in column `from` go onto column `to`. `from: 's'` means "deal". */
export interface Move {
  from: Pile;
  index: number;
  to: Pile;
}

export type Action =
  /** Tap a card: move it (and the cards on it) to the best place. Tap the stock: deal. */
  | { type: 'tap'; pile: Pile; index: number }
  /** Drag a card (and the cards on it) onto a column. */
  | { type: 'move'; from: Pile; index: number; to: Pile }
  | { type: 'deal' }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  /** The move isn't possible. `reason` says why, for the status line. */
  | { kind: 'invalid'; pile: Pile; index: number; reason: string }
  /** `completed`: complete runs taken off by this move or deal. */
  | { kind: 'moved'; to: Pile; n: number; completed: number }
  | { kind: 'dealt'; completed: number }
  | { kind: 'undone' }
  /** A hint (`from: 's'` for "deal"), or null with a reason when there's no good move. */
  | { kind: 'hint'; move: Move | null; text?: string }
  | { kind: 'won' };

export const SUIT_COUNT: Record<SpiderMode, 1 | 2 | 4> = { suit1: 1, suit2: 2, suit4: 4, daily: 1 };

const col = (p: Pile) => Number(p.slice(1));

// ---------- Dealing ----------

/**
 * The 104 cards: eight full suits. With one suit they're all spades, with two spades and
 * hearts. Ids are copy * 52 + face (core/cards), so every card is unique.
 */
export function spiderDeck(suits: 1 | 2 | 4): Card[] {
  const out: Card[] = [];
  const copies = 8 / suits;
  const suitIds = [0, 1, 2, 3].slice(0, suits);
  for (let k = 0; k < copies; k++) for (const s of suitIds) for (let r = 0; r < 13; r++) out.push(k * 52 + s * 13 + r);
  return out;
}

/** Columns 1–4 get six cards, 5–10 five; only the top card is face up. The other 50 are the stock. */
export function deal(mode: SpiderMode, deck: Card[], date?: string): SpiderGame {
  const cards = deck.slice();
  const tableau: Card[][] = [];
  for (let i = 0; i < COLUMNS; i++) tableau.push(cards.splice(0, i < 4 ? 6 : 5));
  return {
    mode,
    ...(date ? { date } : {}),
    tableau,
    faceDown: tableau.map((c) => c.length - 1),
    stock: cards,
    done: [],
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

/** A random deal (not checked for winnability: see `newWinnableGame` in solver.ts). */
export const newGame = (mode: SpiderMode, rng: Rng, date?: string): SpiderGame => deal(mode, shuffleCards(spiderDeck(SUIT_COUNT[mode]), rng), date);

// ---------- Reading the board ----------

export const progress = (g: SpiderGame) => g.done.length / RUNS;
/** Deals left in the stock. */
export const dealsLeft = (g: SpiderGame) => g.stock.length / COLUMNS;

export function pileCards(g: SpiderGame, p: Pile): Card[] {
  return p === 's' ? g.stock : g.tableau[col(p)];
}

/** Does `upper` continue a run on `lower` (same suit, one lower)? */
const follows = (lower: Card, upper: Card) => suitOf(lower) === suitOf(upper) && rankOf(lower) === rankOf(upper) + 1;

/** Can the cards from `index` up be picked up: face up and one suit in order? */
export function canPickUp(g: SpiderGame, p: Pile, index: number): boolean {
  if (p[0] !== 't') return false;
  const cards = g.tableau[col(p)];
  if (index < g.faceDown[col(p)] || index >= cards.length) return false;
  for (let k = index + 1; k < cards.length; k++) if (!follows(cards[k - 1], cards[k])) return false;
  return true;
}

/** A card can go onto a card one rank higher (any suit), or into an empty column. */
export function canPlace(g: SpiderGame, card: Card, to: Pile): boolean {
  if (to === 's') return false;
  const target = g.tableau[col(to)];
  return !target.length || rankOf(target[target.length - 1]) === rankOf(card) + 1;
}

export function whyNot(g: SpiderGame, m: Move): string | null {
  if (m.from === 's' || m.from === m.to) return 'That card can’t go there';
  if (!canPickUp(g, m.from, m.index)) return 'Only a run of one suit can move together';
  return canPlace(g, g.tableau[col(m.from)][m.index], m.to) ? null : 'That card can’t go there';
}

/** Dealing needs cards in the stock and no empty column. */
export function whyNoDeal(g: SpiderGame): string | null {
  if (!g.stock.length) return 'The stock is empty';
  if (g.tableau.some((c) => !c.length)) return 'Fill every empty column before dealing';
  return null;
}

// ---------- Changing the board ----------

const clone = (g: SpiderGame): SpiderGame => ({
  ...g,
  tableau: g.tableau.map((c) => c.slice()),
  faceDown: g.faceDown.slice(),
  stock: g.stock.slice(),
  done: g.done.slice(),
});

/** Turn over the top card of column `i` if it's face down (mutates `g`). */
function flipTop(g: SpiderGame, i: number): boolean {
  if (g.faceDown[i] > 0 && g.faceDown[i] >= g.tableau[i].length) {
    g.faceDown[i] = g.tableau[i].length - 1;
    return true;
  }
  return false;
}

/** Take a complete run (king to ace of one suit) off the top of column `i` (mutates `g`). */
function complete(g: SpiderGame, i: number): Completion | null {
  const c = g.tableau[i];
  const start = c.length - 13;
  if (start < g.faceDown[i] || rankOf(c[start]) !== 13 || !canPickUp(g, `t${i}`, start)) return null;
  g.done.push(c.splice(start, 13));
  return { col: i, flip: flipTop(g, i) };
}

const pushHistory = (h: UndoStep[], s: UndoStep) => [...h, s].slice(-UNDO_LIMIT);

function finishStep(g: SpiderGame, prev: SpiderGame, step: UndoStep, record: boolean): SpiderGame {
  g.moves++;
  g.touched = true;
  if (record) g.history = pushHistory(prev.history, step);
  if (g.done.length === RUNS) g.status = 'won';
  return g;
}

/** Move without checking (the caller checked `whyNot`). */
export function applyMove(g: SpiderGame, m: Move, record = true): SpiderGame {
  const next = clone(g);
  const from = col(m.from);
  const to = col(m.to);
  const n = next.tableau[from].length - m.index;
  next.tableau[to].push(...next.tableau[from].splice(m.index, n));
  const flip = flipTop(next, from);
  const c = complete(next, to);
  return finishStep(next, g, { t: 'move', from, to, n, flip, done: c ? [c] : [] }, record);
}

/** One card from the stock onto every column (the caller checked `whyNoDeal`). */
export function applyDeal(g: SpiderGame, record = true): SpiderGame {
  const next = clone(g);
  for (let i = 0; i < COLUMNS; i++) next.tableau[i].push(next.stock.pop()!);
  const done: Completion[] = [];
  for (let i = 0; i < COLUMNS; i++) {
    const c = complete(next, i);
    if (c) done.push(c);
  }
  return finishStep(next, g, { t: 'deal', done }, record);
}

function undo(g: SpiderGame): SpiderGame {
  const step = g.history[g.history.length - 1];
  if (!step) return g;
  const next = clone(g);
  next.history = g.history.slice(0, -1);
  next.undos++;
  next.touched = true;
  for (let k = step.done.length - 1; k >= 0; k--) {
    const d = step.done[k];
    if (d.flip) next.faceDown[d.col]++;
    next.tableau[d.col].push(...next.done.pop()!);
  }
  if (step.t === 'deal') {
    for (let i = COLUMNS - 1; i >= 0; i--) next.stock.push(next.tableau[i].pop()!);
  } else {
    const run = next.tableau[step.to].splice(next.tableau[step.to].length - step.n, step.n);
    if (step.flip) next.faceDown[step.from]++;
    next.tableau[step.from].push(...run);
  }
  return next;
}

/**
 * Where a tapped card goes: onto a card of its suit one rank higher, else onto any card one
 * rank higher, else an empty column (unless it's already at the bottom of one).
 */
export function bestTarget(g: SpiderGame, from: Pile, index: number): Pile | null {
  if (!canPickUp(g, from, index)) return null;
  const card = g.tableau[col(from)][index];
  let any: Pile | null = null;
  let empty: Pile | null = null;
  for (let k = 1; k < COLUMNS; k++) {
    const i = (col(from) + k) % COLUMNS;
    const target = g.tableau[i];
    if (!canPlace(g, card, `t${i}`)) continue;
    if (!target.length) {
      if (!empty && index > 0) empty = `t${i}`;
    } else if (follows(target[target.length - 1], card)) {
      return `t${i}`;
    } else if (!any) {
      any = `t${i}`;
    }
  }
  return any ?? empty;
}

// ---------- Hints and "no more moves" ----------

/**
 * Moves that make progress, best first: moves that turn over a card, a run onto its own suit that
 * wasn't on its suit yet, moves that empty a column, then moving a run into an empty column to turn
 * over the card under it. Moving runs back and forth is left out.
 */
export function usefulMoves(g: SpiderGame): Move[] {
  const scored: [number, Move][] = [];
  // Columns whose face-up cards could go into an empty column to turn over the card under them.
  const flippable = g.tableau.filter((_, i) => g.faceDown[i] > 0 && canPickUp(g, `t${i}`, g.faceDown[i])).length;
  for (let i = 0; i < COLUMNS; i++) {
    const cards = g.tableau[i];
    for (let index = g.faceDown[i]; index < cards.length; index++) {
      if (!canPickUp(g, `t${i}`, index)) continue;
      const under = index > 0 ? cards[index - 1] : null;
      const onSuitAlready = under != null && index > g.faceDown[i] && follows(under, cards[index]);
      const turnsOver = index === g.faceDown[i] && index > 0;
      for (let j = 0; j < COLUMNS; j++) {
        const target = g.tableau[j];
        if (i === j || !target.length || !canPlace(g, cards[index], `t${j}`)) continue;
        const toSuit = follows(target[target.length - 1], cards[index]);
        const empties = index === 0;
        // Anything else (e.g. leaving a same-suit link for another one) just shuffles cards around.
        let score = 0;
        if (toSuit && under != null && !onSuitAlready) score += 3;
        if (turnsOver) score += 4;
        // An empty column only helps if something can use it (else hints would move runs back and forth).
        if (empties && flippable) score += 2;
        if (score) scored.push([score + (cards.length - index) / 100, { from: `t${i}`, index, to: `t${j}` }]);
      }
      // Into an empty column, when that turns over a card.
      const empty = g.tableau.findIndex((c) => !c.length);
      if (empty >= 0 && turnsOver) scored.push([1 + (cards.length - index) / 100, { from: `t${i}`, index, to: `t${empty}` }]);
    }
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, m]) => m);
}

/** The hint: a useful move, else dealing (or filling an empty column so the stock can be dealt), else null with a reason. */
export function hint(g: SpiderGame): { move: Move | null; text?: string } {
  const m = usefulMoves(g)[0];
  if (m) return { move: m };
  if (!whyNoDeal(g)) return { move: { from: 's', index: g.stock.length - 1, to: 's' } };
  const empty = g.tableau.findIndex((c) => !c.length);
  if (empty >= 0 && g.stock.length) {
    // Fill the empty column so the stock can be dealt: the top run of the tallest column.
    let from = -1;
    for (let i = 0; i < COLUMNS; i++) if (g.tableau[i].length > 1 && (from < 0 || g.tableau[i].length > g.tableau[from].length)) from = i;
    if (from >= 0) {
      let index = g.tableau[from].length - 1;
      while (index > 1 && canPickUp(g, `t${from}`, index - 1)) index--;
      return { move: { from: `t${from}`, index, to: `t${empty}` } };
    }
    return { move: null, text: 'Fill every empty column, then deal' };
  }
  if (empty >= 0) return { move: null, text: 'No sure move · try using the empty column' };
  return { move: null };
}

/** Nothing useful is left: the stock is used up, no column is empty, and no move makes progress. */
export const isStuck = (g: SpiderGame) =>
  g.status === 'playing' && !g.stock.length && g.tableau.every((c) => c.length) && !usefulMoves(g).length;

// ---------- Reducer ----------

/** Apply an action. Returns the same object when nothing changed. */
export function reduce(g: SpiderGame, action: Action): [SpiderGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'deal':
      return dealEvent(g);
    case 'tap': {
      if (action.pile === 's') return dealEvent(g);
      if (action.pile[0] !== 't') return [g, { kind: 'none' }];
      const i = col(action.pile);
      if (action.index < g.faceDown[i] || action.index >= g.tableau[i].length) return [g, { kind: 'none' }];
      if (!canPickUp(g, action.pile, action.index)) {
        return [g, { kind: 'invalid', pile: action.pile, index: action.index, reason: 'Only a run of one suit can move together' }];
      }
      const to = bestTarget(g, action.pile, action.index);
      if (!to) return [g, { kind: 'invalid', pile: action.pile, index: action.index, reason: 'That card has nowhere to go' }];
      return moveEvent(g, { from: action.pile, index: action.index, to });
    }
    case 'move': {
      const m = { from: action.from, index: action.index, to: action.to };
      const reason = whyNot(g, m);
      if (reason) return [g, { kind: 'invalid', pile: action.from, index: action.index, reason }];
      return moveEvent(g, m);
    }
    case 'undo':
      if (!g.history.length) return [g, { kind: 'none' }];
      return [undo(g), { kind: 'undone' }];
    case 'hint':
      return [{ ...g, hints: g.hints + 1, touched: true }, { kind: 'hint', ...hint(g) }];
  }
}

function dealEvent(g: SpiderGame): [SpiderGame, Event] {
  const reason = whyNoDeal(g);
  if (reason) return [g, { kind: 'invalid', pile: 's', index: -1, reason }];
  const next = applyDeal(g);
  if (next.status === 'won') return [next, { kind: 'won' }];
  return [next, { kind: 'dealt', completed: next.done.length - g.done.length }];
}

function moveEvent(g: SpiderGame, m: Move): [SpiderGame, Event] {
  const next = applyMove(g, m);
  if (next.status === 'won') return [next, { kind: 'won' }];
  return [next, { kind: 'moved', to: m.to, n: g.tableau[col(m.from)].length - m.index, completed: next.done.length - g.done.length }];
}
