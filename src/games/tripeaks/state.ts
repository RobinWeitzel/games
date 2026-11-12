import type { Rng } from '../../core/random';
import { Card, rankOf, shuffledDeck } from '../../core/cards';

/**
 * TriPeaks game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * 28 cards form three overlapping peaks. A card is free when no card overlaps it from below.
 * Free cards go onto the waste when they are one rank above or below its top card (king and
 * ace connect). The stock turns over a new waste card. Clear the peaks to win.
 *
 * The whole TriPeaksGame object is persisted (games/game/tripeaks/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type TriPeaksMode = 'classic' | 'daily';

export const PEAK_CARDS = 28;
export const UNDO_LIMIT = 500;

/**
 * Peak positions, row by row: row 0 the three tips (0–2), row 1 (3–8), row 2 (9–17), row 3 the
 * ten cards at the bottom (18–27). `x` is in card widths from the left, `row` from the top.
 */
export const POSITIONS: { row: number; x: number }[] = [
  ...[1.5, 4.5, 7.5].map((x) => ({ row: 0, x })),
  ...[1, 2, 4, 5, 7, 8].map((x) => ({ row: 1, x })),
  ...Array.from({ length: 9 }, (_, i) => ({ row: 2, x: i + 0.5 })),
  ...Array.from({ length: 10 }, (_, i) => ({ row: 3, x: i })),
];

/** The cards that overlap each peak card from the row below (it's free once they're gone). */
export const COVERED_BY: number[][] = POSITIONS.map((p) =>
  POSITIONS.map((q, j) => (q.row === p.row + 1 && Math.abs(q.x - p.x) === 0.5 ? j : -1)).filter((j) => j >= 0),
);

export type UndoStep = { t: 'play'; i: number; streak: number } | { t: 'draw'; streak: number };

export interface TriPeaksGame {
  mode: TriPeaksMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  /** The 28 peak cards, by position. */
  peaks: Card[];
  /** Peak cards already played. */
  cleared: boolean[];
  /** Face down; the top is the last element. */
  stock: Card[];
  /** Face up; the top is the last element. */
  waste: Card[];
  status: 'playing' | 'won';
  /** Cards played in a row since the last draw. */
  streak: number;
  longestStreak: number;
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  history: UndoStep[];
}

export type Action = { type: 'play'; i: number } | { type: 'draw' } | { type: 'undo' } | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'invalid'; i: number; reason: string }
  /** `peak`: a peak's tip was cleared. */
  | { kind: 'played'; i: number; peak: boolean }
  | { kind: 'drew' }
  | { kind: 'undone' }
  /** A hint: a card to play (`i`), or -1 for "draw", or null when stuck. */
  | { kind: 'hint'; i: number | null }
  | { kind: 'won' };

// ---------- Reading the board ----------

export const isFree = (g: TriPeaksGame, i: number) => !g.cleared[i] && COVERED_BY[i].every((j) => g.cleared[j]);

/** One rank apart, with king and ace next to each other. */
export const adjacent = (a: Card, b: Card) => {
  const d = Math.abs(rankOf(a) - rankOf(b));
  return d === 1 || d === 12;
};

export const canPlay = (g: TriPeaksGame, i: number) => isFree(g, i) && g.waste.length > 0 && adjacent(g.peaks[i], g.waste[g.waste.length - 1]);
export const playable = (g: TriPeaksGame) => g.peaks.map((_, i) => i).filter((i) => canPlay(g, i));
export const clearedCount = (g: TriPeaksGame) => g.cleared.filter(Boolean).length;
export const progress = (g: TriPeaksGame) => clearedCount(g) / PEAK_CARDS;
/** No card can be played and the stock is empty. */
export const isStuck = (g: TriPeaksGame) => g.status === 'playing' && !g.stock.length && !playable(g).length;

// ---------- Dealing ----------

export function deal(mode: TriPeaksMode, deck: Card[], date?: string): TriPeaksGame {
  const cards = deck.slice();
  const peaks = cards.splice(0, PEAK_CARDS);
  const waste = [cards.pop()!];
  return {
    mode,
    ...(date ? { date } : {}),
    peaks,
    cleared: new Array(PEAK_CARDS).fill(false),
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
 * Depth-first search for a way to clear the peaks, remembering positions already seen.
 * Returns the moves (peak index, or -1 for "draw") or null if none was found within `budget`.
 */
export function solve(start: TriPeaksGame, budget = 60000): number[] | null {
  const seen = new Set<string>();
  const path: number[] = [];
  let nodes = 0;
  const cleared = start.cleared.slice();
  const peaks = start.peaks;
  const rec = (drawn: number, top: Card, left: number): boolean => {
    if (!left) return true;
    if (++nodes > budget) return false;
    let mask = 0;
    for (let i = 0; i < PEAK_CARDS; i++) if (cleared[i]) mask |= 1 << i;
    const key = `${mask}:${drawn}:${top}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const free: number[] = [];
    for (let i = 0; i < PEAK_CARDS; i++) if (!cleared[i] && COVERED_BY[i].every((j) => cleared[j]) && adjacent(peaks[i], top)) free.push(i);
    // Cards that free other cards first.
    free.sort((a, b) => a - b);
    for (const i of free) {
      cleared[i] = true;
      path.push(i);
      if (rec(drawn, peaks[i], left - 1)) return true;
      path.pop();
      cleared[i] = false;
      if (nodes > budget) return false;
    }
    if (drawn < start.stock.length) {
      path.push(-1);
      if (rec(drawn + 1, start.stock[start.stock.length - 1 - drawn], left)) return true;
      path.pop();
    }
    return false;
  };
  const ok = rec(0, start.waste[start.waste.length - 1], PEAK_CARDS - clearedCount(start));
  return ok ? path.slice() : null;
}

const MAX_TRIES = 40;

/** A new deal that the solver has cleared, so every game can be won. */
export function newGame(mode: TriPeaksMode, rng: Rng, date?: string): TriPeaksGame {
  let g = deal(mode, shuffledDeck(rng), date);
  for (let i = 0; i < MAX_TRIES && !solve(g); i++) g = deal(mode, shuffledDeck(rng), date);
  return g;
}

// ---------- Reducer ----------

const pushHistory = (h: UndoStep[], s: UndoStep) => [...h, s].slice(-UNDO_LIMIT);

/** A good next move: the first move of a found solution, else any playable card, else draw. */
export function hintMove(g: TriPeaksGame): number | null {
  const path = solve(g, 20000);
  if (path?.length) return path[0];
  const p = playable(g);
  if (p.length) return p[0];
  return g.stock.length ? -1 : null;
}

export function reduce(g: TriPeaksGame, action: Action): [TriPeaksGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'play': {
      const i = action.i;
      if (i < 0 || i >= PEAK_CARDS || g.cleared[i]) return [g, { kind: 'none' }];
      if (!isFree(g, i)) return [g, { kind: 'invalid', i, reason: 'That card is still covered' }];
      if (!canPlay(g, i)) return [g, { kind: 'invalid', i, reason: 'Only a card one higher or lower than the waste card' }];
      const cleared = g.cleared.slice();
      cleared[i] = true;
      const streak = g.streak + 1;
      const next: TriPeaksGame = {
        ...g,
        cleared,
        waste: [...g.waste, g.peaks[i]],
        streak,
        longestStreak: Math.max(g.longestStreak, streak),
        moves: g.moves + 1,
        touched: true,
        history: pushHistory(g.history, { t: 'play', i, streak: g.streak }),
      };
      if (cleared.every(Boolean)) return [{ ...next, status: 'won' }, { kind: 'won' }];
      return [next, { kind: 'played', i, peak: i < 3 }];
    }
    case 'draw': {
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
    }
    case 'undo': {
      const step = g.history[g.history.length - 1];
      if (!step) return [g, { kind: 'none' }];
      const top = g.waste[g.waste.length - 1];
      const base = { ...g, waste: g.waste.slice(0, -1), streak: step.streak, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true };
      if (step.t === 'draw') return [{ ...base, stock: [...g.stock, top] }, { kind: 'undone' }];
      const cleared = g.cleared.slice();
      cleared[step.i] = false;
      return [{ ...base, cleared }, { kind: 'undone' }];
    }
    case 'hint':
      return [{ ...g, hints: g.hints + 1, touched: true }, { kind: 'hint', i: hintMove(g) }];
  }
}
