import type { Rng } from '../../core/random';
import { Card, rankOf, shuffledDeck } from '../../core/cards';

/**
 * Golf solitaire game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * Seven columns of five face-up cards. The top card of a column goes onto the waste when it is
 * one rank above or below the waste card (no wrapping between king and ace). The stock turns
 * over a new waste card. Clear all 35 cards to win.
 *
 * The whole GolfGame object is persisted (games/game/golf/save, schema v1), so changing its
 * shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type GolfMode = 'classic' | 'daily';

export const COLUMNS = 7;
export const DEPTH = 5;
export const TABLE_CARDS = COLUMNS * DEPTH;
export const UNDO_LIMIT = 500;

export type UndoStep = { t: 'play'; col: number; streak: number } | { t: 'draw'; streak: number };

export interface GolfGame {
  mode: GolfMode;
  date?: string;
  /** Seven columns, bottom first; the top card is the last one. */
  columns: Card[][];
  stock: Card[];
  waste: Card[];
  status: 'playing' | 'won';
  streak: number;
  longestStreak: number;
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  history: UndoStep[];
}

export type Action = { type: 'play'; col: number } | { type: 'draw' } | { type: 'undo' } | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'invalid'; col: number; reason: string }
  /** `cleared`: the column is now empty. */
  | { kind: 'played'; col: number; cleared: boolean }
  | { kind: 'drew' }
  | { kind: 'undone' }
  /** A column to play, -1 for "draw", or null when stuck. */
  | { kind: 'hint'; col: number | null }
  | { kind: 'won' };

/** One rank apart (a king and an ace are not). */
export const adjacent = (a: Card, b: Card) => Math.abs(rankOf(a) - rankOf(b)) === 1;

export const canPlay = (g: GolfGame, col: number) => {
  const c = g.columns[col];
  return c.length > 0 && g.waste.length > 0 && adjacent(c[c.length - 1], g.waste[g.waste.length - 1]);
};
export const playable = (g: GolfGame) => g.columns.map((_, i) => i).filter((i) => canPlay(g, i));
export const cardsLeft = (g: GolfGame) => g.columns.reduce((n, c) => n + c.length, 0);
export const progress = (g: GolfGame) => 1 - cardsLeft(g) / TABLE_CARDS;
export const isStuck = (g: GolfGame) => g.status === 'playing' && !g.stock.length && !playable(g).length;

export function deal(mode: GolfMode, deck: Card[], date?: string): GolfGame {
  const cards = deck.slice();
  const columns = Array.from({ length: COLUMNS }, () => cards.splice(0, DEPTH));
  const waste = [cards.pop()!];
  return {
    mode,
    ...(date ? { date } : {}),
    columns,
    stock: cards,
    waste,
    status: 'playing',
    streak: 0,
    longestStreak: 0,
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

/**
 * Depth-first search with memory of positions seen. Returns the moves (column, or -1 for
 * "draw") or null if none was found within `budget`.
 */
export function solve(start: GolfGame, budget = 80000): number[] | null {
  const heights = start.columns.map((c) => c.length);
  const seen = new Set<string>();
  const path: number[] = [];
  let nodes = 0;
  const rec = (drawn: number, top: Card, left: number): boolean => {
    if (!left) return true;
    if (++nodes > budget) return false;
    const key = `${heights.join('')}:${drawn}:${top}`;
    if (seen.has(key)) return false;
    seen.add(key);
    // Tallest columns first: they are the hardest to clear later.
    const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => heights[b] - heights[a]);
    for (const i of order) {
      if (!heights[i]) continue;
      const card = start.columns[i][heights[i] - 1];
      if (!adjacent(card, top)) continue;
      heights[i]--;
      path.push(i);
      if (rec(drawn, card, left - 1)) return true;
      path.pop();
      heights[i]++;
      if (nodes > budget) return false;
    }
    if (drawn < start.stock.length) {
      path.push(-1);
      if (rec(drawn + 1, start.stock[start.stock.length - 1 - drawn], left)) return true;
      path.pop();
    }
    return false;
  };
  return rec(0, start.waste[start.waste.length - 1], cardsLeft(start)) ? path.slice() : null;
}

/**
 * A deal that can be won, built backwards from a winning game: a random order of plays (each
 * column five times) and draws is laid out first, then cards are handed out so that every play
 * is one rank from the waste card. Only about a third of random deals can be won, and proving
 * that takes a search, so building a winnable deal directly is both faster and certain.
 */
export function newGame(mode: GolfMode, rng: Rng, date?: string): GolfGame {
  for (;;) {
    // 35 plays and 16 draws, in random order (the first waste card is turned up before).
    const steps: number[] = [];
    for (let i = 0; i < COLUMNS; i++) for (let k = 0; k < DEPTH; k++) steps.push(i);
    for (let k = 0; k < 52 - TABLE_CARDS - 1; k++) steps.push(-1);
    for (let i = steps.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [steps[i], steps[j]] = [steps[j], steps[i]];
    }
    const pool = shuffledDeck(rng);
    let top = pool.pop()!;
    const firstWaste = top;
    const played: Card[][] = Array.from({ length: COLUMNS }, () => []);
    const drawn: Card[] = [];
    let ok = true;
    for (const s of steps) {
      let card: Card;
      if (s < 0) card = pool.pop()!;
      else {
        const k = pool.findIndex((c) => adjacent(c, top));
        if (k < 0) {
          ok = false;
          break;
        }
        card = pool.splice(k, 1)[0];
      }
      if (s < 0) drawn.push(card);
      else played[s].push(card);
      top = card;
    }
    if (!ok) continue;
    // A column is played from the top down; the stock is drawn from its end.
    const columns = played.map((cards) => cards.slice().reverse());
    return deal(mode, [...columns.flat(), ...drawn.slice().reverse(), firstWaste], date);
  }
}

/** A good next move: the first move of a found solution, else any playable column, else draw. */
export function hintMove(g: GolfGame): number | null {
  const path = solve(g, 30000);
  if (path?.length) return path[0];
  const p = playable(g);
  if (p.length) return p[0];
  return g.stock.length ? -1 : null;
}

const pushHistory = (h: UndoStep[], s: UndoStep) => [...h, s].slice(-UNDO_LIMIT);

export function reduce(g: GolfGame, action: Action): [GolfGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'play': {
      const col = action.col;
      if (col < 0 || col >= COLUMNS || !g.columns[col].length) return [g, { kind: 'none' }];
      if (!canPlay(g, col)) return [g, { kind: 'invalid', col, reason: 'Only a card one higher or lower than the waste card' }];
      const columns = g.columns.map((c) => c.slice());
      const card = columns[col].pop()!;
      const streak = g.streak + 1;
      const next: GolfGame = {
        ...g,
        columns,
        waste: [...g.waste, card],
        streak,
        longestStreak: Math.max(g.longestStreak, streak),
        moves: g.moves + 1,
        touched: true,
        history: pushHistory(g.history, { t: 'play', col, streak: g.streak }),
      };
      if (!cardsLeft(next)) return [{ ...next, status: 'won' }, { kind: 'won' }];
      return [next, { kind: 'played', col, cleared: !columns[col].length }];
    }
    case 'draw':
      if (!g.stock.length) return [g, { kind: 'none' }];
      return [
        {
          ...g,
          stock: g.stock.slice(0, -1),
          waste: [...g.waste, g.stock[g.stock.length - 1]],
          streak: 0,
          moves: g.moves + 1,
          touched: true,
          history: pushHistory(g.history, { t: 'draw', streak: g.streak }),
        },
        { kind: 'drew' },
      ];
    case 'undo': {
      const step = g.history[g.history.length - 1];
      if (!step) return [g, { kind: 'none' }];
      const top = g.waste[g.waste.length - 1];
      const base = { ...g, waste: g.waste.slice(0, -1), streak: step.streak, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true };
      if (step.t === 'draw') return [{ ...base, stock: [...g.stock, top] }, { kind: 'undone' }];
      const columns = g.columns.map((c) => c.slice());
      columns[step.col].push(top);
      return [{ ...base, columns }, { kind: 'undone' }];
    }
    case 'hint':
      return [{ ...g, hints: g.hints + 1, touched: true }, { kind: 'hint', col: hintMove(g) }];
  }
}
