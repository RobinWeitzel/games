import { Difficulty, isBlack, neighbours, sightLines } from './engine';

/**
 * Light Up game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole LightUpGame object is persisted (games/game/light-up/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type LightUpMode = Difficulty | 'daily';

export const EMPTY = 0;
export const BULB = 1;
export const DOT = 2;
export const UNDO_LIMIT = 500;

export interface LightUpGame {
  mode: LightUpMode;
  difficulty: Difficulty;
  date?: string;
  n: number;
  /** WHITE, BLACK or a number 0–4 (engine.ts). */
  cells: number[];
  solution: number[];
  /** EMPTY, BULB or DOT (“no bulb here”) per cell. */
  marks: number[];
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  history: { cells: number[]; prev: number[] }[];
}

export type Action =
  /** Tap: empty → bulb → dot → empty. */
  | { type: 'tap'; cell: number }
  /** A drag over empty white cells: dots (one undo step). */
  | { type: 'dot'; cells: number[] }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'changed'; bulb: boolean; conflict: boolean }
  | { kind: 'undone' }
  | { kind: 'hint'; cell: number | null }
  | { kind: 'won' };

export function newGame(p: { mode: LightUpMode; difficulty: Difficulty; n: number; cells: number[]; solution: number[]; date?: string }): LightUpGame {
  return {
    mode: p.mode,
    difficulty: p.difficulty,
    ...(p.date ? { date: p.date } : {}),
    n: p.n,
    cells: p.cells,
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

const sightCache = new WeakMap<number[], number[][]>();
/** Sight lines of the puzzle (cached per puzzle). */
export function sight(g: LightUpGame): number[][] {
  let s = sightCache.get(g.cells);
  if (!s) sightCache.set(g.cells, (s = sightLines(g.n, g.cells)));
  return s;
}

/** Lit white cells (a bulb's own cell included). */
export function litCells(g: LightUpGame): Set<number> {
  const lit = new Set<number>();
  const s = sight(g);
  g.marks.forEach((m, i) => {
    if (m !== BULB) return;
    lit.add(i);
    s[i].forEach((j) => lit.add(j));
  });
  return lit;
}

/** Bulbs that light another bulb. */
export function clashes(g: LightUpGame): Set<number> {
  const s = sight(g);
  const out = new Set<number>();
  g.marks.forEach((m, i) => {
    if (m === BULB && s[i].some((j) => g.marks[j] === BULB)) out.add(i);
  });
  return out;
}

/** For every numbered black cell: 'ok' (exact), 'over' (too many bulbs around) or 'open'. */
export function numberStates(g: LightUpGame): Map<number, 'ok' | 'over' | 'open'> {
  const out = new Map<number, 'ok' | 'over' | 'open'>();
  g.cells.forEach((v, i) => {
    if (v < 0) return;
    const bulbs = neighbours(g.n, i).filter((j) => g.marks[j] === BULB).length;
    out.set(i, bulbs === v ? 'ok' : bulbs > v ? 'over' : 'open');
  });
  return out;
}

const whites = (g: LightUpGame) => g.cells.map((v, i) => (isBlack(v) ? -1 : i)).filter((i) => i >= 0);
export const progress = (g: LightUpGame) => {
  const w = whites(g);
  const lit = litCells(g);
  return w.filter((i) => lit.has(i)).length / w.length;
};

export function isSolved(g: LightUpGame): boolean {
  const lit = litCells(g);
  return whites(g).every((i) => lit.has(i)) && clashes(g).size === 0 && [...numberStates(g).values()].every((s) => s === 'ok');
}

function change(g: LightUpGame, cells: number[], values: number[]): LightUpGame {
  const marks = g.marks.slice();
  const prev = cells.map((c) => marks[c]);
  cells.forEach((c, i) => (marks[c] = values[i]));
  const next: LightUpGame = { ...g, marks, moves: g.moves + 1, touched: true, history: [...g.history, { cells, prev }].slice(-UNDO_LIMIT) };
  if (isSolved(next)) next.status = 'won';
  return next;
}

export function reduce(g: LightUpGame, action: Action): [LightUpGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'tap': {
      const c = action.cell;
      if (c < 0 || c >= g.cells.length || isBlack(g.cells[c])) return [g, { kind: 'none' }];
      const value = (g.marks[c] + 1) % 3;
      const next = change(g, [c], [value]);
      if (next.status === 'won') return [next, { kind: 'won' }];
      const bulb = value === BULB;
      const conflict = bulb && (clashes(next).has(c) || neighbours(g.n, c).some((b) => numberStates(next).get(b) === 'over'));
      return [next, { kind: 'changed', bulb, conflict }];
    }
    case 'dot': {
      const cells = action.cells.filter((c) => !isBlack(g.cells[c]) && g.marks[c] === EMPTY);
      if (!cells.length) return [g, { kind: 'none' }];
      return [change(g, cells, cells.map(() => DOT)), { kind: 'changed', bulb: false, conflict: false }];
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
      let cell = g.marks.findIndex((m, i) => m === BULB && !sol.has(i));
      let value = EMPTY;
      if (cell < 0) {
        // A missing bulb: next to a number first (the most telling), else any.
        const missing = g.solution.filter((s) => g.marks[s] !== BULB);
        missing.sort((a, b) => Number(neighbours(g.n, b).some((j) => g.cells[j] >= 0)) - Number(neighbours(g.n, a).some((j) => g.cells[j] >= 0)));
        cell = missing[0] ?? -1;
        value = BULB;
      }
      if (cell < 0) return [counted, { kind: 'hint', cell: null }];
      const next = change(counted, [cell], [value]);
      return [next, next.status === 'won' ? { kind: 'won' } : { kind: 'hint', cell }];
    }
  }
}
