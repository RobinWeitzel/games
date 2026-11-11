import type { Rng } from '../../core/random';

/**
 * Solitaire (Klondike) game logic: pure functions only (no storage, no UI), unit-tested in
 * state.test.ts.
 *
 * The whole SolitaireGame object is persisted (games/game/solitaire/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type SolitaireMode = 'draw1' | 'draw3' | 'daily';

/** Cards are numbers 0–51: suit * 13 + (rank - 1). Suits: 0 ♠, 1 ♥, 2 ♦, 3 ♣. */
export type Card = number;
export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const RANK_NAMES = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

export const suitOf = (c: Card) => Math.floor(c / 13);
/** 1 (ace) – 13 (king). */
export const rankOf = (c: Card) => (c % 13) + 1;
export const isRed = (c: Card) => suitOf(c) === 1 || suitOf(c) === 2;
/** "7♥" */
export const cardText = (c: Card) => `${RANKS[rankOf(c) - 1]}${SUITS[suitOf(c)]}`;
/** "7 of hearts" (VoiceOver). */
export const cardName = (c: Card) => `${RANK_NAMES[rankOf(c) - 1]} of ${SUIT_NAMES[suitOf(c)]}`;

/**
 * A pile: tableau column 't0'…'t6', foundation 'f0'…'f3' (one per suit, in suit order),
 * the waste 'w' or the stock 's'.
 */
export type Pile = `t${number}` | `f${number}` | 'w' | 's';

/** One undoable step, stored so it can be reversed exactly. */
export type UndoStep =
  /** `n` cards went from `from` to `to`; `flip`: the card under them was turned face up. */
  | { t: 'move'; from: Pile; to: Pile; n: number; flip: boolean }
  /** `n` cards were drawn from the stock to the waste. */
  | { t: 'draw'; n: number }
  /** The waste was turned over into the stock. */
  | { t: 'recycle' };

export interface SolitaireGame {
  mode: SolitaireMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  /** Cards turned per tap on the stock. */
  draw: 1 | 3;
  /** Face down; the top is the last element. */
  stock: Card[];
  /** Face up; the top is the last element. */
  waste: Card[];
  /** Cards on each suit's foundation (0–13), so the top card is suit * 13 + count - 1. */
  foundations: number[];
  /** Seven columns, bottom first. */
  tableau: Card[][];
  /** How many cards at the bottom of each column are face down. */
  faceDown: number[];
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

export type Action =
  /** Tap a card (or a pile): move it to the best place it can go, or draw from the stock. */
  | { type: 'tap'; pile: Pile; index: number }
  /** Drag a card (and the cards on it) onto a pile. */
  | { type: 'move'; from: Pile; index: number; to: Pile }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  /** The tapped card has nowhere to go. */
  | { kind: 'invalid'; pile: Pile; index: number }
  | { kind: 'moved'; from: Pile; to: Pile; n: number; foundation: boolean }
  | { kind: 'drew' }
  | { kind: 'undone' }
  /** A hint: what to move where (`to` is 's' for "draw from the stock"). */
  | { kind: 'hint'; move: Move | null }
  | { kind: 'won' };

/** A move in the game: `index` is the position in the source pile of the first card moved. */
export interface Move {
  from: Pile;
  index: number;
  to: Pile;
}

// ---------- Dealing ----------

export function shuffledDeck(rng: Rng): Card[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Classic Klondike deal: column i gets i + 1 cards, the top one face up; the rest is the stock. */
export function deal(mode: SolitaireMode, deck: Card[], date?: string): SolitaireGame {
  const cards = deck.slice();
  const tableau: Card[][] = [];
  for (let i = 0; i < 7; i++) tableau.push(cards.splice(0, i + 1));
  return {
    mode,
    ...(date ? { date } : {}),
    draw: mode === 'draw3' ? 3 : 1,
    stock: cards,
    waste: [],
    foundations: [0, 0, 0, 0],
    tableau,
    faceDown: [0, 1, 2, 3, 4, 5, 6],
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

/**
 * The solver proves about 58% of Draw 1 and 38% of Draw 3 deals winnable within its budget
 * (~50ms per deal), so a new game takes ~2 tries. After MAX_TRIES (rare) the deal is kept as is.
 */
const MAX_TRIES = 15;

/**
 * A new game that can be won: random deals are tried until the solver wins one, so the player
 * never gets a hopeless deal. (The solver plays conservatively, so "won" is a proof.)
 */
export function newGame(mode: SolitaireMode, rng: Rng, date?: string): SolitaireGame {
  let g = deal(mode, shuffledDeck(rng), date);
  for (let i = 0; i < MAX_TRIES && !isWinnable(g); i++) g = deal(mode, shuffledDeck(rng), date);
  return g;
}

// ---------- Reading the board ----------

export const foundationCount = (g: SolitaireGame) => g.foundations.reduce((a, b) => a + b, 0);
export const progress = (g: SolitaireGame) => foundationCount(g) / 52;

/** The cards in a pile, bottom first. */
export function pileCards(g: SolitaireGame, p: Pile): Card[] {
  if (p === 's') return g.stock;
  if (p === 'w') return g.waste;
  const i = Number(p.slice(1));
  if (p[0] === 'f') return Array.from({ length: g.foundations[i] }, (_, k) => i * 13 + k);
  return g.tableau[i];
}

/** Can the cards from `index` up be picked up from this pile? */
export function canPickUp(g: SolitaireGame, p: Pile, index: number): boolean {
  const cards = pileCards(g, p);
  if (index < 0 || index >= cards.length) return false;
  if (p === 's') return false;
  if (p[0] === 't') {
    const i = Number(p.slice(1));
    if (index < g.faceDown[i]) return false;
    // A face-up run in the tableau is always alternating colours, descending.
    return true;
  }
  return index === cards.length - 1; // waste and foundation: only the top card
}

/** Can `card` (with `n` cards in total) be put onto pile `to`? */
export function canPlace(g: SolitaireGame, card: Card, n: number, to: Pile): boolean {
  if (to === 's' || to === 'w') return false;
  const i = Number(to.slice(1));
  if (to[0] === 'f') return n === 1 && suitOf(card) === i && g.foundations[i] === rankOf(card) - 1;
  const col = g.tableau[i];
  if (!col.length) return rankOf(card) === 13;
  const top = col[col.length - 1];
  return isRed(top) !== isRed(card) && rankOf(top) === rankOf(card) + 1;
}

export function isLegal(g: SolitaireGame, m: Move): boolean {
  if (m.from === m.to || !canPickUp(g, m.from, m.index)) return false;
  const cards = pileCards(g, m.from);
  return canPlace(g, cards[m.index], cards.length - m.index, m.to);
}

/** The game can be finished automatically: everything is face up and the stock is used up. */
export function canAutoFinish(g: SolitaireGame): boolean {
  return g.status === 'playing' && !g.stock.length && !g.waste.length && g.faceDown.every((n) => n === 0);
}

/** The next card to put on a foundation when finishing automatically. */
export function autoFinishMove(g: SolitaireGame): Move | null {
  let best: Move | null = null;
  let bestRank = 99;
  for (let i = 0; i < 7; i++) {
    const col = g.tableau[i];
    if (!col.length) continue;
    const c = col[col.length - 1];
    const to: Pile = `f${suitOf(c)}`;
    if (canPlace(g, c, 1, to) && rankOf(c) < bestRank) {
      best = { from: `t${i}`, index: col.length - 1, to };
      bestRank = rankOf(c);
    }
  }
  return best;
}

// ---------- Changing the board ----------

const clone = (g: SolitaireGame): SolitaireGame => ({
  ...g,
  stock: g.stock.slice(),
  waste: g.waste.slice(),
  foundations: g.foundations.slice(),
  tableau: g.tableau.map((c) => c.slice()),
  faceDown: g.faceDown.slice(),
});

/** Take the top `n` cards off a pile (mutates the clone `g`). */
function take(g: SolitaireGame, p: Pile, n: number): Card[] {
  if (p[0] === 'f') {
    const i = Number(p.slice(1));
    g.foundations[i] -= n;
    return Array.from({ length: n }, (_, k) => i * 13 + g.foundations[i] + k);
  }
  const arr = p === 'w' ? g.waste : p === 's' ? g.stock : g.tableau[Number(p.slice(1))];
  return arr.splice(arr.length - n, n);
}

function put(g: SolitaireGame, p: Pile, cards: Card[]): void {
  if (p[0] === 'f') g.foundations[Number(p.slice(1))] += cards.length;
  else (p === 'w' ? g.waste : p === 's' ? g.stock : g.tableau[Number(p.slice(1))]).push(...cards);
}

const pushHistory = (h: UndoStep[], s: UndoStep) => [...h, s].slice(-UNDO_LIMIT);

/** Move without checking (the caller checked `isLegal`). Turns over the card left behind. */
function applyMove(g: SolitaireGame, m: Move, record = true): SolitaireGame {
  const next = clone(g);
  const n = pileCards(g, m.from).length - m.index;
  put(next, m.to, take(next, m.from, n));
  let flip = false;
  if (m.from[0] === 't') {
    const i = Number(m.from.slice(1));
    if (next.faceDown[i] > 0 && next.faceDown[i] >= next.tableau[i].length) {
      next.faceDown[i] = next.tableau[i].length - 1;
      flip = true;
    }
  }
  next.moves++;
  next.touched = true;
  if (record) next.history = pushHistory(g.history, { t: 'move', from: m.from, to: m.to, n, flip });
  if (foundationCount(next) === 52) next.status = 'won';
  return next;
}

/** Tap on the stock: turn over 1 or 3 cards, or turn the waste back over when the stock is empty. */
function drawCards(g: SolitaireGame, record = true): SolitaireGame {
  const next = clone(g);
  let step: UndoStep;
  if (next.stock.length) {
    const n = Math.min(g.draw, next.stock.length);
    // The top stock card ends up first in the fan, the third one on top of the waste.
    next.waste.push(...next.stock.splice(next.stock.length - n, n).reverse());
    step = { t: 'draw', n };
  } else {
    next.stock = next.waste.reverse();
    next.waste = [];
    step = { t: 'recycle' };
  }
  next.moves++;
  next.touched = true;
  if (record) next.history = pushHistory(g.history, step);
  return next;
}

function undo(g: SolitaireGame): SolitaireGame {
  const step = g.history[g.history.length - 1];
  if (!step) return g;
  const next = clone(g);
  next.history = g.history.slice(0, -1);
  next.undos++;
  next.touched = true;
  if (step.t === 'draw') {
    next.stock.push(...next.waste.splice(next.waste.length - step.n, step.n).reverse());
  } else if (step.t === 'recycle') {
    next.waste = next.stock.reverse();
    next.stock = [];
  } else {
    if (step.flip) next.faceDown[Number(step.from.slice(1))]++;
    put(next, step.from, take(next, step.to, step.n));
  }
  return next;
}

/** Where a tapped card goes: its foundation first, else a column it fits on (empty ones last). */
export function bestTarget(g: SolitaireGame, from: Pile, index: number): Pile | null {
  if (!canPickUp(g, from, index)) return null;
  const cards = pileCards(g, from);
  const card = cards[index];
  const n = cards.length - index;
  const f: Pile = `f${suitOf(card)}`;
  if (from[0] !== 'f' && canPlace(g, card, n, f)) return f;
  const start = from[0] === 't' ? Number(from.slice(1)) + 1 : 0;
  let empty: Pile | null = null;
  for (let k = 0; k < 7; k++) {
    const i = (start + k) % 7;
    const to: Pile = `t${i}`;
    if (to === from || !canPlace(g, card, n, to)) continue;
    if (g.tableau[i].length) return to;
    // A king that is already at the bottom of a column doesn't move to another empty column.
    if (!empty && !(from[0] === 't' && index === 0)) empty = to;
  }
  return empty;
}

// ---------- Useful moves (hints, "no more moves", solver) ----------

/** Is there a king that could use an empty column (not already at the bottom of one)? */
function kingWaiting(g: SolitaireGame): boolean {
  const king = (c: Card) => rankOf(c) === 13;
  if (g.stock.some(king) || g.waste.some(king)) return true;
  return g.tableau.some((col, i) => col.some((c, k) => king(c) && k > 0 && k >= g.faceDown[i]) || col.slice(0, g.faceDown[i]).some(king));
}

/**
 * Moves that make progress, best first: to a foundation, moves that turn over a card or free a
 * column for a king, then waste cards onto the tableau. Shuffling runs between columns back and
 * forth is left out, so "no useful move" means the game is stuck.
 */
export function usefulMoves(g: SolitaireGame): Move[] {
  const out: Move[] = [];
  const top = (p: Pile) => pileCards(g, p).length - 1;
  // 1. Onto a foundation.
  for (let i = 0; i < 7; i++) {
    const col = g.tableau[i];
    if (col.length && canPlace(g, col[col.length - 1], 1, `f${suitOf(col[col.length - 1])}`)) {
      out.push({ from: `t${i}`, index: col.length - 1, to: `f${suitOf(col[col.length - 1])}` });
    }
  }
  if (g.waste.length) {
    const c = g.waste[g.waste.length - 1];
    if (canPlace(g, c, 1, `f${suitOf(c)}`)) out.push({ from: 'w', index: top('w'), to: `f${suitOf(c)}` });
  }
  // 2. Tableau runs that uncover something.
  const kings = kingWaiting(g);
  for (let i = 0; i < 7; i++) {
    const col = g.tableau[i];
    const base = g.faceDown[i];
    if (base >= col.length) continue;
    for (let j = 0; j < 7; j++) {
      if (i === j) continue;
      for (let index = base; index < col.length; index++) {
        if (!canPlace(g, col[index], col.length - index, `t${j}`)) continue;
        const under = index > 0 ? col[index - 1] : null;
        const turnsOver = index === base && base > 0;
        const freesColumn = index === 0 && g.tableau[j].length > 0 && kings;
        // The face-up card underneath can then go to its foundation.
        const freesFoundation = under != null && index > base && canPlace(g, under, 1, `f${suitOf(under)}`);
        if (turnsOver || freesColumn || freesFoundation) out.push({ from: `t${i}`, index, to: `t${j}` });
      }
    }
  }
  // 3. The waste card onto the tableau.
  if (g.waste.length) {
    const c = g.waste[g.waste.length - 1];
    for (let j = 0; j < 7; j++) if (canPlace(g, c, 1, `t${j}`)) out.push({ from: 'w', index: top('w'), to: `t${j}` });
  }
  return out;
}

/** Could any card in the stock or waste come up on the waste and be played, without other moves? */
export function stockHelps(g: SolitaireGame): boolean {
  let s = g;
  const total = g.stock.length + g.waste.length;
  if (!total) return false;
  // Two full passes through the stock cover every card that can come up.
  for (let k = 0; k < 2 * (total + 1); k++) {
    s = drawCards(s, false);
    if (!s.waste.length) continue;
    const c = s.waste[s.waste.length - 1];
    if (canPlace(s, c, 1, `f${suitOf(c)}`)) return true;
    for (let j = 0; j < 7; j++) if (canPlace(s, c, 1, `t${j}`)) return true;
  }
  return false;
}

/** The hint: a useful move, or the stock (`to: 's'`) when drawing will help, or null when stuck. */
export function hintMove(g: SolitaireGame): Move | null {
  const m = usefulMoves(g)[0];
  if (m) return m;
  if (stockHelps(g)) return { from: 's', index: g.stock.length - 1, to: 's' };
  return null;
}

/** No useful move is left (the player can still undo or start over). */
export const isStuck = (g: SolitaireGame) => g.status === 'playing' && hintMove(g) == null;

// ---------- Solver ----------

/** Foundation moves that can never hurt: low cards, or both opposite-colour foundations are close behind. */
function safeToFoundation(g: SolitaireGame, c: Card): boolean {
  const r = rankOf(c);
  if (r <= 2) return true;
  const opp = isRed(c) ? [0, 3] : [1, 2];
  return opp.every((s) => g.foundations[s] >= r - 1);
}

const keyOf = (g: SolitaireGame) =>
  `${g.tableau.map((c, i) => `${g.faceDown[i]}:${c.join(',')}`).join('|')}/${g.foundations.join(',')}/${g.stock.join(',')}/${g.waste.join(',')}`;

/**
 * Depth-first search over useful moves (plus drawing) with a node budget. True means a way to
 * win was found; false means none was found within the budget.
 */
export function isWinnable(start: SolitaireGame, budget = 1500): boolean {
  const seen = new Set<string>();
  const stack: SolitaireGame[] = [start];
  let nodes = 0;
  while (stack.length) {
    let g = stack.pop()!;
    // Play the moves that can never hurt right away.
    for (let changed = true; changed; ) {
      changed = false;
      for (const m of usefulMoves(g)) {
        if (m.to[0] !== 'f') continue;
        const c = pileCards(g, m.from)[m.index];
        if (safeToFoundation(g, c)) {
          g = applyMove(g, m, false);
          changed = true;
          break;
        }
      }
    }
    if (foundationCount(g) === 52) return true;
    // Everything face up and the stock used up: the rest plays itself.
    if (canAutoFinish(g)) return true;
    const key = keyOf(g);
    if (seen.has(key)) continue;
    seen.add(key);
    if (++nodes > budget) return false;
    if (g.stock.length || g.waste.length) stack.push(drawCards(g, false));
    const moves = usefulMoves(g);
    for (let k = moves.length - 1; k >= 0; k--) stack.push(applyMove(g, moves[k], false));
  }
  return false;
}

// ---------- Reducer ----------

/** Apply an action. Returns the same object when nothing changed. */
export function reduce(g: SolitaireGame, action: Action): [SolitaireGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'tap': {
      if (action.pile === 's') {
        if (!g.stock.length && !g.waste.length) return [g, { kind: 'none' }];
        return [drawCards(g), { kind: 'drew' }];
      }
      if (action.pile[0] === 't' && action.index < g.faceDown[Number(action.pile.slice(1))]) return [g, { kind: 'none' }];
      if (!canPickUp(g, action.pile, action.index)) return [g, { kind: 'none' }];
      const to = bestTarget(g, action.pile, action.index);
      if (!to) return [g, { kind: 'invalid', pile: action.pile, index: action.index }];
      return moveEvent(g, { from: action.pile, index: action.index, to });
    }
    case 'move': {
      const m = { from: action.from, index: action.index, to: action.to };
      if (!isLegal(g, m)) return [g, { kind: 'invalid', pile: action.from, index: action.index }];
      return moveEvent(g, m);
    }
    case 'undo': {
      if (!g.history.length) return [g, { kind: 'none' }];
      return [undo(g), { kind: 'undone' }];
    }
    case 'hint':
      return [{ ...g, hints: g.hints + 1, touched: true }, { kind: 'hint', move: hintMove(g) }];
  }
}

function moveEvent(g: SolitaireGame, m: Move): [SolitaireGame, Event] {
  const next = applyMove(g, m);
  if (next.status === 'won') return [next, { kind: 'won' }];
  const n = pileCards(g, m.from).length - m.index;
  return [next, { kind: 'moved', from: m.from, to: m.to, n, foundation: m.to[0] === 'f' }];
}
