import { Difficulty, blockCells, blocks, components, neighbours } from './engine';

/**
 * Nurikabe game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole NurikabeGame object is persisted (games/game/nurikabe/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type NurikabeMode = Difficulty | 'daily';

export const EMPTY = 0;
/** A shaded (sea) cell. */
export const SEA = 1;
/** A dot: "this cell is part of an island". */
export const DOT = 2;
export const UNDO_LIMIT = 500;

export interface NurikabeGame {
  mode: NurikabeMode;
  difficulty: Difficulty;
  date?: string;
  n: number;
  /** Island size for numbered cells, 0 elsewhere. */
  clues: number[];
  /** true for sea cells in the (only) solution. */
  solution: boolean[];
  /** EMPTY, SEA or DOT per cell (numbered cells stay EMPTY). */
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
  /** Tap: empty → sea → dot → empty. */
  | { type: 'tap'; cell: number }
  /** A drag: every cell gets `value` (one undo step). */
  | { type: 'paint'; cells: number[]; value: number }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'changed'; sea: boolean; mistake: boolean }
  | { kind: 'undone' }
  | { kind: 'hint'; cell: number | null }
  | { kind: 'won' };

export function newGame(p: { mode: NurikabeMode; difficulty: Difficulty; n: number; clues: number[]; solution: boolean[]; date?: string }): NurikabeGame {
  return {
    mode: p.mode,
    difficulty: p.difficulty,
    ...(p.date ? { date: p.date } : {}),
    n: p.n,
    clues: p.clues,
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

/** The value a tap gives a cell. */
export const nextMark = (m: number) => (m + 1) % 3;

/** Cells of 2 × 2 blocks that are all sea. */
export function pools(g: NurikabeGame): Set<number> {
  const out = new Set<number>();
  for (const b of blocks(g.n)) {
    const cells = blockCells(g.n, b);
    if (cells.every((c) => g.marks[c] === SEA)) cells.forEach((c) => out.add(c));
  }
  return out;
}

/**
 * For every number: 'ok' when it's walled in by sea with exactly its size, 'bad' when its island
 * (dots joined to it) is too big or reaches another number, or when the sea leaves it too little room.
 */
export function numberStates(g: NurikabeGame): Map<number, 'ok' | 'bad' | 'open'> {
  const out = new Map<number, 'ok' | 'bad' | 'open'>();
  const n = g.n;
  const regions = components(n, (i) => g.marks[i] !== SEA);
  const land = components(n, (i) => g.clues[i] > 0 || g.marks[i] === DOT);
  const regionOf = new Int32Array(n * n).fill(-1);
  regions.forEach((r, k) => r.forEach((c) => (regionOf[c] = k)));
  const landOf = new Int32Array(n * n).fill(-1);
  land.forEach((r, k) => r.forEach((c) => (landOf[c] = k)));
  g.clues.forEach((v, i) => {
    if (!v) return;
    const isle = land[landOf[i]];
    const region = regions[regionOf[i]];
    const numsInRegion = region.filter((c) => g.clues[c] > 0).length;
    if (isle.length > v || isle.some((c) => c !== i && g.clues[c] > 0) || region.length < v) out.set(i, 'bad');
    else if (numsInRegion === 1 && region.length === v) out.set(i, 'ok');
    else out.set(i, 'open');
  });
  return out;
}

/** Share of the sea that is shaded correctly. */
export function progress(g: NurikabeGame): number {
  let sea = 0;
  let right = 0;
  g.solution.forEach((s, i) => {
    if (!s) return;
    sea++;
    if (g.marks[i] === SEA) right++;
  });
  return sea ? right / sea : 0;
}

/** Solved when the shaded cells are exactly the solution's sea (the puzzle has one solution). */
export const isSolved = (g: NurikabeGame) => g.solution.every((s, i) => s === (g.marks[i] === SEA));

function change(g: NurikabeGame, cells: number[], values: number[]): NurikabeGame {
  const marks = g.marks.slice();
  const prev = cells.map((c) => marks[c]);
  cells.forEach((c, i) => (marks[c] = values[i]));
  const next: NurikabeGame = { ...g, marks, moves: g.moves + 1, touched: true, history: [...g.history, { cells, prev }].slice(-UNDO_LIMIT) };
  if (isSolved(next)) next.status = 'won';
  return next;
}

/** Did the change create a 2 × 2 sea block or break a number? */
function mistakeMade(before: NurikabeGame, after: NurikabeGame): boolean {
  if (pools(after).size > pools(before).size) return true;
  const a = numberStates(before);
  for (const [cell, st] of numberStates(after)) if (st === 'bad' && a.get(cell) !== 'bad') return true;
  return false;
}

export function reduce(g: NurikabeGame, action: Action): [NurikabeGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'tap':
      return reduce(g, { type: 'paint', cells: [action.cell], value: nextMark(g.marks[action.cell] ?? 0) });
    case 'paint': {
      const cells = [...new Set(action.cells)].filter((c) => c >= 0 && c < g.clues.length && !g.clues[c] && g.marks[c] !== action.value);
      if (!cells.length) return [g, { kind: 'none' }];
      const next = change(g, cells, cells.map(() => action.value));
      if (next.status === 'won') return [next, { kind: 'won' }];
      return [next, { kind: 'changed', sea: action.value === SEA, mistake: mistakeMade(g, next) }];
    }
    case 'undo': {
      const step = g.history[g.history.length - 1];
      if (!step) return [g, { kind: 'none' }];
      const marks = g.marks.slice();
      step.cells.forEach((c, i) => (marks[c] = step.prev[i]));
      return [{ ...g, marks, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true }, { kind: 'undone' }];
    }
    case 'hint': {
      const counted = { ...g, hints: g.hints + 1, touched: true };
      // First a wrong mark: shading on land, or a dot in the sea.
      let cell = g.marks.findIndex((m, i) => (m === SEA && !g.solution[i]) || (m === DOT && g.solution[i]));
      let value = EMPTY;
      if (cell < 0) {
        // Else a missing sea cell, the one with the most decided neighbours (the most telling).
        const decided = (c: number) => neighbours(g.n, c).filter((j) => g.marks[j] !== EMPTY || g.clues[j] > 0).length;
        const missing = g.solution.map((s, i) => (s && g.marks[i] !== SEA ? i : -1)).filter((i) => i >= 0);
        missing.sort((a, b) => decided(b) - decided(a) || a - b);
        cell = missing[0] ?? -1;
        value = SEA;
      }
      if (cell < 0) return [counted, { kind: 'hint', cell: null }];
      const next = change(counted, [cell], [value]);
      return [next, next.status === 'won' ? { kind: 'won' } : { kind: 'hint', cell }];
    }
  }
}
