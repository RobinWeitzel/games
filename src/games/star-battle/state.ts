import { touching } from './engine';

/**
 * Star Battle game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole StarBattleGame object is persisted (games/game/star-battle/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type StarBattleMode = 'small' | 'medium' | 'large' | 'daily';

/** What the player put in a cell. */
export const EMPTY = 0;
export const CROSS = 1;
export const STAR = 2;

export const UNDO_LIMIT = 500;

export interface StarBattleGame {
  mode: StarBattleMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  n: number;
  /** Stars per row, column and region. */
  k: number;
  regions: number[];
  solution: number[];
  /** EMPTY, CROSS or STAR per cell. */
  marks: number[];
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  /** Undo steps: cells changed together and what they held before. Most recent last. */
  history: { cells: number[]; prev: number[] }[];
}

export type Action =
  /** Tap: empty → cross → star → empty. */
  | { type: 'tap'; cell: number }
  /** A drag over empty cells: crosses (one undo step). */
  | { type: 'cross'; cells: number[] }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  /** `conflict`: the new star breaks a rule (the board shows which stars). */
  | { kind: 'changed'; star: boolean; conflict: boolean }
  | { kind: 'undone' }
  | { kind: 'hint'; cell: number | null }
  | { kind: 'won' };

export function newGame(p: { mode: StarBattleMode; n: number; k: number; regions: number[]; solution: number[]; date?: string }): StarBattleGame {
  return {
    mode: p.mode,
    ...(p.date ? { date: p.date } : {}),
    n: p.n,
    k: p.k,
    regions: p.regions,
    solution: p.solution,
    marks: new Array(p.n * p.n).fill(EMPTY),
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

const starsOf = (g: StarBattleGame) => g.marks.map((m, i) => (m === STAR ? i : -1)).filter((i) => i >= 0);
export const starCount = (g: StarBattleGame) => g.marks.filter((m) => m === STAR).length;
export const progress = (g: StarBattleGame) => Math.min(1, starCount(g) / (g.n * g.k));

/** Stars that break a rule: touching another star, or too many in their row, column or region. */
export function conflicts(g: StarBattleGame): Set<number> {
  const out = new Set<number>();
  const stars = starsOf(g);
  const n = g.n;
  const rows = new Array(n).fill(0);
  const cols = new Array(n).fill(0);
  const regs = new Array(n).fill(0);
  for (const s of stars) {
    rows[Math.floor(s / n)]++;
    cols[s % n]++;
    regs[g.regions[s]]++;
  }
  for (const s of stars) {
    if (rows[Math.floor(s / n)] > g.k || cols[s % n] > g.k || regs[g.regions[s]] > g.k) out.add(s);
    for (const t of stars) if (touching(n, s, t)) out.add(s);
  }
  return out;
}

/** Why a star is in conflict, for VoiceOver and the status line. */
export function conflictReason(g: StarBattleGame, s: number): string {
  const n = g.n;
  const stars = starsOf(g);
  if (stars.some((t) => touching(n, s, t))) return 'touches another star';
  const count = (f: (t: number) => boolean) => stars.filter(f).length;
  if (count((t) => Math.floor(t / n) === Math.floor(s / n)) > g.k) return 'too many stars in the row';
  if (count((t) => t % n === s % n) > g.k) return 'too many stars in the column';
  return 'too many stars in the region';
}

export const isSolved = (g: StarBattleGame) => starCount(g) === g.n * g.k && conflicts(g).size === 0;

function change(g: StarBattleGame, cells: number[], values: number[], record = true): StarBattleGame {
  const marks = g.marks.slice();
  const prev = cells.map((c) => marks[c]);
  cells.forEach((c, i) => (marks[c] = values[i]));
  const next: StarBattleGame = { ...g, marks, moves: g.moves + 1, touched: true };
  if (record) next.history = [...g.history, { cells, prev }].slice(-UNDO_LIMIT);
  if (isSolved(next)) next.status = 'won';
  return next;
}

export function reduce(g: StarBattleGame, action: Action): [StarBattleGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'tap': {
      const c = action.cell;
      if (c < 0 || c >= g.marks.length) return [g, { kind: 'none' }];
      const value = (g.marks[c] + 1) % 3;
      const next = change(g, [c], [value]);
      if (next.status === 'won') return [next, { kind: 'won' }];
      return [next, { kind: 'changed', star: value === STAR, conflict: value === STAR && conflicts(next).has(c) }];
    }
    case 'cross': {
      const cells = action.cells.filter((c) => g.marks[c] === EMPTY);
      if (!cells.length) return [g, { kind: 'none' }];
      return [change(g, cells, cells.map(() => CROSS)), { kind: 'changed', star: false, conflict: false }];
    }
    case 'undo': {
      const step = g.history[g.history.length - 1];
      if (!step) return [g, { kind: 'none' }];
      const marks = g.marks.slice();
      step.cells.forEach((c, i) => (marks[c] = step.prev[i]));
      return [{ ...g, marks, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true }, { kind: 'undone' }];
    }
    case 'hint': {
      const sol = new Set(g.solution);
      const counted = { ...g, hints: g.hints + 1, touched: true };
      // A wrong star first, then a cross on a star's cell, then a missing star (in the region with the fewest open cells).
      let cell = g.marks.findIndex((m, i) => m === STAR && !sol.has(i));
      let value = EMPTY;
      if (cell < 0) {
        cell = g.solution.find((s) => g.marks[s] === CROSS) ?? -1;
        value = STAR;
      }
      if (cell < 0) {
        const missing = g.solution.filter((s) => g.marks[s] !== STAR);
        const open = (s: number) => g.marks.filter((m, i) => m === EMPTY && g.regions[i] === g.regions[s]).length;
        missing.sort((a, b) => open(a) - open(b));
        cell = missing[0] ?? -1;
        value = STAR;
      }
      if (cell < 0) return [counted, { kind: 'hint', cell: null }];
      const next = change(counted, [cell], [value]);
      return [next, next.status === 'won' ? { kind: 'won' } : { kind: 'hint', cell }];
    }
  }
}

/**
 * Start the puzzle over: every mark is cleared and the undo history goes. Time and hints are
 * kept, and it counts as one undo (an assist), so restarting can't improve a result. Returns the
 * same object when there's nothing to clear.
 */
export function restart(g: StarBattleGame): StarBattleGame {
  if (g.status !== 'playing' || g.marks.every((m) => m === EMPTY)) return g;
  return { ...g, marks: g.marks.map(() => EMPTY), history: [], undos: g.undos + 1, touched: true };
}
