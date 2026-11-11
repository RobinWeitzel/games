/**
 * Nonogram line solver: pure functions, unit-tested in solver.test.ts.
 *
 * A puzzle is accepted only if `solveByLines` fills in every cell. That means it can be solved
 * one row or column at a time, by logic alone (no guessing), and that its solution is unique.
 */

/** Cell knowledge while solving: unknown, known empty, known filled. */
export const UNKNOWN = -1;
export const EMPTY = 0;
export const FILLED = 1;

/** Run lengths of filled cells in a line, e.g. [1,1,0,1,1,1] → [2, 3]. An empty line is []. */
export function runs(line: ArrayLike<number>): number[] {
  const out: number[] = [];
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === FILLED) n++;
    else if (n) {
      out.push(n);
      n = 0;
    }
  }
  if (n) out.push(n);
  return out;
}

export interface Clues {
  rows: number[][];
  cols: number[][];
}

/** Row and column clues of a solution grid (row-major, 1 = filled). */
export function cluesOf(solution: ArrayLike<number>, rows: number, cols: number): Clues {
  const r: number[][] = [];
  const c: number[][] = [];
  for (let y = 0; y < rows; y++) r.push(runs(Array.from({ length: cols }, (_, x) => solution[y * cols + x])));
  for (let x = 0; x < cols; x++) c.push(runs(Array.from({ length: rows }, (_, y) => solution[y * cols + x])));
  return { rows: r, cols: c };
}

/**
 * Everything that follows for one line from its clue and what's already known: the result has
 * FILLED / EMPTY where every arrangement of the clue that fits `known` agrees, else UNKNOWN.
 * Returns null if no arrangement fits (a contradiction).
 *
 * Dynamic programming over (position, block): `can(i, j)` = cells i.. can hold blocks j.., where
 * cell i may start a block. Then every reachable arrangement marks which values each cell can take.
 */
export function solveLine(clue: number[], known: number[]): number[] | null {
  const n = known.length;
  const k = clue.length;
  const memo = new Int8Array((n + 2) * (k + 1)); // 0 = not computed, 1 = false, 2 = true
  const idx = (i: number, j: number) => Math.min(i, n + 1) * (k + 1) + j;

  // Block j fits at i: no known-empty cell inside it, and the cell after it isn't known-filled.
  const fits = (i: number, j: number) => {
    const end = i + clue[j];
    if (end > n) return false;
    for (let p = i; p < end; p++) if (known[p] === EMPTY) return false;
    return end === n || known[end] !== FILLED;
  };

  const can = (i: number, j: number): boolean => {
    if (i >= n) return j === k;
    const m = memo[idx(i, j)];
    if (m) return m === 2;
    let ok: boolean;
    if (j === k) {
      ok = true;
      for (let p = i; p < n; p++) if (known[p] === FILLED) ok = false;
    } else {
      ok = (known[i] !== FILLED && can(i + 1, j)) || (fits(i, j) && can(i + clue[j] + 1, j + 1));
    }
    memo[idx(i, j)] = ok ? 2 : 1;
    return ok;
  };

  if (!can(0, 0)) return null;

  const canFill = new Uint8Array(n);
  const canEmpty = new Uint8Array(n);
  const seen = new Uint8Array((n + 2) * (k + 1));
  const mark = (i: number, j: number) => {
    if (i >= n || seen[idx(i, j)]) return;
    seen[idx(i, j)] = 1;
    if (j === k) {
      for (let p = i; p < n; p++) canEmpty[p] = 1;
      return;
    }
    if (known[i] !== FILLED && can(i + 1, j)) {
      canEmpty[i] = 1;
      mark(i + 1, j);
    }
    if (fits(i, j) && can(i + clue[j] + 1, j + 1)) {
      const end = i + clue[j];
      for (let p = i; p < end; p++) canFill[p] = 1;
      if (end < n) canEmpty[end] = 1;
      mark(end + 1, j + 1);
    }
  };
  mark(0, 0);

  const out = new Array<number>(n);
  for (let p = 0; p < n; p++) out[p] = canFill[p] && canEmpty[p] ? UNKNOWN : canFill[p] ? FILLED : EMPTY;
  return out;
}

/**
 * Solve as far as single lines allow, starting from `known` (row-major, UNKNOWN / EMPTY /
 * FILLED; all unknown by default). Returns the grid (cells that can't be deduced stay UNKNOWN),
 * or null if the clues contradict what's known.
 */
export function solveByLines(clues: Clues, known?: number[]): number[] | null {
  const rows = clues.rows.length;
  const cols = clues.cols.length;
  const grid = known ? known.slice() : new Array<number>(rows * cols).fill(UNKNOWN);
  // Lines to look at: 0..rows-1 are rows, rows.. are columns.
  const dirty = new Uint8Array(rows + cols).fill(1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let l = 0; l < rows + cols; l++) {
      if (!dirty[l]) continue;
      dirty[l] = 0;
      const isRow = l < rows;
      const len = isRow ? cols : rows;
      const at = (p: number) => (isRow ? l * cols + p : p * cols + (l - rows));
      const line = Array.from({ length: len }, (_, p) => grid[at(p)]);
      if (!line.includes(UNKNOWN)) {
        // Fully known: just check it.
        const r = runs(line);
        const clue = isRow ? clues.rows[l] : clues.cols[l - rows];
        if (r.length !== clue.length || r.some((v, i) => v !== clue[i])) return null;
        continue;
      }
      const solved = solveLine(isRow ? clues.rows[l] : clues.cols[l - rows], line);
      if (!solved) return null;
      for (let p = 0; p < len; p++) {
        if (line[p] === UNKNOWN && solved[p] !== UNKNOWN) {
          grid[at(p)] = solved[p];
          // The crossing line learned something.
          dirty[isRow ? rows + p : p] = 1;
          changed = true;
        }
      }
    }
  }
  return grid;
}

/** The puzzle can be solved line by line, without guessing (and so has exactly one solution). */
export function isLineSolvable(clues: Clues): boolean {
  const g = solveByLines(clues);
  return !!g && !g.includes(UNKNOWN);
}
