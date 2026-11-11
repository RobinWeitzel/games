import type { Rng } from '../../core/random';
import { Clues, EMPTY, FILLED, UNKNOWN, cluesOf, isLineSolvable, runs, solveLine } from './solver';

/**
 * Nonogram game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole NonogramGame object is persisted (games/game/nonogram/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type NonogramMode = 'small' | 'medium' | 'large' | 'daily';

/** Board sizes (square). */
export const SIZES: Record<NonogramMode, number> = { small: 5, medium: 10, large: 15, daily: 10 };

/** Cell states in `NonogramGame.cells`. */
export const BLANK = 0;
export const FILL = 1;
export const CROSS = 2;

/** Undo steps kept (each is one stroke or hint). */
const HISTORY = 200;

export interface NonogramGame {
  mode: NonogramMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  rows: number;
  cols: number;
  /** The picture: 1 = filled, per cell (row-major). Clues are derived from it. */
  solution: number[];
  /** BLANK / FILL / CROSS per cell: what the player has marked. */
  cells: number[];
  /** Taps and drags place crosses instead of filling cells. */
  crossMode: boolean;
  /** Earlier `cells`, one string per undo step ("0120…"), newest last. */
  history: string[];
  status: 'playing' | 'won';
  elapsedMs: number;
  hints: number;
  /** The player made a move (an untouched game isn't counted when abandoned). */
  touched: boolean;
}

export type Action =
  /** One stroke (a tap is a stroke of one cell): every cell in `cells` becomes `value`. */
  | { type: 'paint'; cells: number[]; value: number }
  | { type: 'undo' }
  | { type: 'toggleCrossMode' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'painted' }
  | { kind: 'undone' }
  /** A hint marked `cell`; `fixed` = it corrected a wrong mark. */
  | { kind: 'hint'; cell: number; fixed: boolean }
  | { kind: 'won' };

/**
 * A random picture that can be solved line by line (so it has exactly one solution). Random
 * cells are smoothed once (each cell takes the majority of its 3×3 neighbourhood), which gives
 * blobby shapes rather than noise, then pictures are tried until the line solver solves one.
 * About 4 in 5 tries succeed even at 15×15, each well under a millisecond.
 */
export function generateSolution(size: number, rng: Rng): number[] {
  for (let tries = 0; ; tries++) {
    const raw: number[] = Array.from({ length: size * size }, () => (rng() < 0.55 ? 1 : 0));
    const g = raw.map((v, i) => {
      const y = Math.floor(i / size);
      const x = i % size;
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= size || xx >= size) continue;
          sum += raw[yy * size + xx];
          n++;
        }
      }
      return sum * 2 > n ? 1 : sum * 2 < n ? 0 : v;
    });
    const filled = g.reduce((a, b) => a + b, 0) / g.length;
    // Not too empty or too full (those are dull), and solvable without guessing.
    if (filled >= 0.35 && filled <= 0.75 && isLineSolvable(cluesOf(g, size, size))) return g;
    if (tries > 10000) throw new Error('nonogram generator failed'); // never happens (see tests)
  }
}

export function newGame(mode: NonogramMode, rng: Rng, date?: string): NonogramGame {
  const size = SIZES[mode];
  return {
    mode,
    ...(date ? { date } : {}),
    rows: size,
    cols: size,
    solution: generateSolution(size, rng),
    cells: new Array(size * size).fill(BLANK),
    crossMode: false,
    history: [],
    status: 'playing',
    elapsedMs: 0,
    hints: 0,
    touched: false,
  };
}

export const clues = (g: Pick<NonogramGame, 'solution' | 'rows' | 'cols'>): Clues => cluesOf(g.solution, g.rows, g.cols);

export const rowOf = (g: NonogramGame, y: number) => g.cells.slice(y * g.cols, (y + 1) * g.cols);
export const colOf = (g: NonogramGame, x: number) => Array.from({ length: g.rows }, (_, y) => g.cells[y * g.cols + x]);

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** The filled cells of a line match its clue (crosses count as empty). */
export function lineSatisfied(line: number[], clue: number[]): boolean {
  return same(runs(line), clue);
}

/** Which rows and columns match their clues (for greying out the clues). */
export function satisfiedLines(g: NonogramGame, c: Clues = clues(g)): { rows: boolean[]; cols: boolean[] } {
  return {
    rows: c.rows.map((clue, y) => lineSatisfied(rowOf(g, y), clue)),
    cols: c.cols.map((clue, x) => lineSatisfied(colOf(g, x), clue)),
  };
}

/** Every line matches its clue. The solution is unique, so the picture is then the solution. */
export function isSolved(g: NonogramGame): boolean {
  const s = satisfiedLines(g);
  return s.rows.every(Boolean) && s.cols.every(Boolean);
}

/** Share of the picture filled in correctly (for the Continue card). */
export function progress(g: NonogramGame): number {
  const total = g.solution.reduce((a, b) => a + b, 0);
  if (!total) return 1;
  return g.cells.reduce((n, s, i) => n + (s === FILL && g.solution[i] ? 1 : 0), 0) / total;
}

/**
 * The value a stroke starting on `cell` paints: fill (or cross, in cross mode), or clear when
 * the cell already holds that mark. A stroke only changes cells in the same state as its first
 * cell, so dragging a fill across crosses leaves them alone, and erasing only erases.
 */
export function strokeValue(g: NonogramGame, cell: number): number {
  const mark = g.crossMode ? CROSS : FILL;
  return g.cells[cell] === mark ? BLANK : mark;
}

/** `cells` with a stroke applied (also used for the live preview while dragging). */
export function applyStroke(g: NonogramGame, stroke: number[], value: number): number[] {
  if (!stroke.length) return g.cells;
  const from = g.cells[stroke[0]];
  const cells = g.cells.slice();
  for (const c of stroke) if (cells[c] === from) cells[c] = value;
  return cells;
}

/** The cells of a drag from `start` to `end`, kept to the row or column of `start`. */
export function strokeCells(g: Pick<NonogramGame, 'cols'>, start: number, end: number, axis: 'row' | 'col'): number[] {
  const sy = Math.floor(start / g.cols);
  const sx = start % g.cols;
  const ey = Math.floor(end / g.cols);
  const ex = end % g.cols;
  const out: number[] = [];
  if (axis === 'row') {
    const step = ex >= sx ? 1 : -1;
    for (let x = sx; x !== ex + step; x += step) out.push(sy * g.cols + x);
  } else {
    const step = ey >= sy ? 1 : -1;
    for (let y = sy; y !== ey + step; y += step) out.push(y * g.cols + sx);
  }
  return out;
}

const encode = (cells: number[]) => cells.join('');
const decode = (s: string) => Array.from(s, Number);

/** Record the current cells as an undo step and move to `cells`. */
function commit(g: NonogramGame, cells: number[]): NonogramGame {
  return { ...g, cells, history: [...g.history, encode(g.cells)].slice(-HISTORY), touched: true };
}

/** Won: the crosses go, so only the picture is left. */
function checkWin(next: NonogramGame, ev: Event): [NonogramGame, Event] {
  if (!isSolved(next)) return [next, ev];
  return [{ ...next, status: 'won', cells: next.solution.map((v) => (v ? FILL : BLANK)) }, { kind: 'won' }];
}

/**
 * The next hint: a wrong mark to correct if there is one (a fill that isn't part of the picture,
 * or a cross on a cell that is), else a cell that follows by logic from a single row or column,
 * else (never needed for a line-solvable puzzle) any unmarked cell.
 */
export function hintCell(g: NonogramGame, rng: Rng): { cell: number; fixed: boolean } | null {
  const wrong = g.cells.flatMap((s, i) => ((s === FILL && !g.solution[i]) || (s === CROSS && g.solution[i]) ? [i] : []));
  if (wrong.length) return { cell: wrong[Math.floor(rng() * wrong.length)], fixed: true };

  // All marks are correct here, so what the lines tell from them is correct too.
  const c = clues(g);
  const known = g.cells.map((s) => (s === FILL ? FILLED : s === CROSS ? EMPTY : UNKNOWN));
  const logical = new Set<number>();
  for (let y = 0; y < g.rows; y++) {
    const line = known.slice(y * g.cols, (y + 1) * g.cols);
    solveLine(c.rows[y], line)?.forEach((v, x) => v !== UNKNOWN && line[x] === UNKNOWN && logical.add(y * g.cols + x));
  }
  for (let x = 0; x < g.cols; x++) {
    const line = Array.from({ length: g.rows }, (_, y) => known[y * g.cols + x]);
    solveLine(c.cols[x], line)?.forEach((v, y) => v !== UNKNOWN && line[y] === UNKNOWN && logical.add(y * g.cols + x));
  }
  // Prefer showing a filled cell: that's what draws the picture.
  const all = [...logical];
  const fills = all.filter((i) => g.solution[i]);
  const pool = fills.length ? fills : all.length ? all : g.cells.flatMap((s, i) => (s === BLANK ? [i] : []));
  return pool.length ? { cell: pool[Math.floor(rng() * pool.length)], fixed: false } : null;
}

/** Apply an action. Returns the same object when nothing changed. `rng` picks hints. */
export function reduce(g: NonogramGame, action: Action, rng: Rng = Math.random): [NonogramGame, Event] {
  if (action.type === 'toggleCrossMode') return [{ ...g, crossMode: !g.crossMode }, { kind: 'none' }];
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'paint': {
      const cells = applyStroke(g, action.cells, action.value);
      if (same(cells, g.cells)) return [g, { kind: 'none' }];
      return checkWin(commit(g, cells), { kind: 'painted' });
    }
    case 'undo': {
      if (!g.history.length) return [g, { kind: 'none' }];
      const cells = decode(g.history[g.history.length - 1]);
      return [{ ...g, cells, history: g.history.slice(0, -1) }, { kind: 'undone' }];
    }
    case 'hint': {
      const h = hintCell(g, rng);
      if (!h) return [g, { kind: 'none' }];
      const cells = g.cells.slice();
      cells[h.cell] = g.solution[h.cell] ? FILL : CROSS;
      return checkWin({ ...commit(g, cells), hints: g.hints + 1 }, { kind: 'hint', ...h });
    }
  }
}
