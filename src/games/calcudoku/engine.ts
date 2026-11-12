import type { Rng } from '../../core/random';
import { shuffle } from '../../core/random';

/**
 * Calcudoku puzzles: a Latin square (every row and column holds 1…n once) split into cages,
 * each with a target and an operation. Puzzles are generated with a unique solution: the
 * solver below counts solutions and a cage layout is only kept when there is exactly one.
 *
 * Cells are numbered row by row: cell = row * size + col.
 */

export type Op = '+' | '−' | '×' | '÷' | '=';

export interface Cage {
  /** Cells of the cage, ascending (the first one carries the label). */
  cells: number[];
  op: Op;
  target: number;
}

export interface Puzzle {
  size: number;
  cages: Cage[];
  solution: number[];
}

/** "12+", "3−", "2÷", "60×", or just "4" for a one-cell cage. */
export const cageLabel = (c: Cage) => (c.op === '=' ? `${c.target}` : `${c.target}${c.op}`);

/** Does a set of values reach the cage's target with its operation (in some order)? */
export function cageHolds(op: Op, target: number, vals: number[]): boolean {
  switch (op) {
    case '=':
      return vals[0] === target;
    case '+':
      return vals.reduce((a, b) => a + b, 0) === target;
    case '×':
      return vals.reduce((a, b) => a * b, 1) === target;
    case '−':
      return vals.length === 2 && Math.abs(vals[0] - vals[1]) === target;
    case '÷': {
      const [a, b] = vals[0] > vals[1] ? vals : [vals[1], vals[0]];
      return vals.length === 2 && a === b * target;
    }
  }
}

// ---------- Latin square ----------

/** A random Latin square by backtracking with shuffled candidates (instant for n ≤ 9). */
export function latinSquare(n: number, rng: Rng): number[] {
  const grid = new Array<number>(n * n).fill(0);
  const rows = new Array(n).fill(0);
  const cols = new Array(n).fill(0);
  const fill = (i: number): boolean => {
    if (i === n * n) return true;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const v of shuffle(Array.from({ length: n }, (_, k) => k + 1), rng)) {
      const b = 1 << v;
      if (rows[r] & b || cols[c] & b) continue;
      grid[i] = v;
      rows[r] |= b;
      cols[c] |= b;
      if (fill(i + 1)) return true;
      rows[r] &= ~b;
      cols[c] &= ~b;
    }
    return false;
  };
  fill(0);
  return grid;
}

// ---------- Cages ----------

/** Random cage sizes, mostly 2 and 3 cells. */
function cageSize(rng: Rng, n: number): number {
  const x = rng();
  if (x < 0.07) return 1;
  if (x < 0.5) return 2;
  if (x < 0.85) return 3;
  return n >= 5 ? 4 : 3;
}

/** Split the grid into connected cages of random sizes. Returns the cage id of every cell. */
export function partition(n: number, rng: Rng): number[] {
  const id = new Array<number>(n * n).fill(-1);
  let next = 0;
  for (const start of shuffle(Array.from({ length: n * n }, (_, i) => i), rng)) {
    if (id[start] >= 0) continue;
    const want = cageSize(rng, n);
    const cells = [start];
    id[start] = next;
    while (cells.length < want) {
      const options: number[] = [];
      for (const c of cells) {
        const r = Math.floor(c / n);
        const col = c % n;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const rr = r + dr;
          const cc = col + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && id[rr * n + cc] < 0) options.push(rr * n + cc);
        }
      }
      if (!options.length) break;
      const pick = options[Math.floor(rng() * options.length)];
      id[pick] = next;
      cells.push(pick);
    }
    next++;
  }
  return id;
}

/** An operation and target for the cage's solution values. */
function chooseOp(vals: number[], rng: Rng): { op: Op; target: number } {
  if (vals.length === 1) return { op: '=', target: vals[0] };
  if (vals.length === 2) {
    const hi = Math.max(...vals);
    const lo = Math.min(...vals);
    if (hi % lo === 0 && hi !== lo && rng() < 0.6) return { op: '÷', target: hi / lo };
    const x = rng();
    if (x < 0.4) return { op: '−', target: hi - lo };
    if (x < 0.7) return { op: '+', target: hi + lo };
    return { op: '×', target: hi * lo };
  }
  return rng() < 0.55 ? { op: '+', target: vals.reduce((a, b) => a + b, 0) } : { op: '×', target: vals.reduce((a, b) => a * b, 1) };
}

export function makeCages(ids: number[], solution: number[], rng: Rng): Cage[] {
  const groups = new Map<number, number[]>();
  ids.forEach((g, i) => groups.set(g, [...(groups.get(g) ?? []), i]));
  return [...groups.values()]
    .map((cells) => ({ cells: cells.sort((a, b) => a - b), ...chooseOp(cells.map((c) => solution[c]), rng) }))
    .sort((a, b) => a.cells[0] - b.cells[0]);
}

// ---------- Solver ----------

/**
 * Every way to fill a cage: value tuples (in the cage's cell order) that reach the target and
 * never repeat a value in a row or column inside the cage.
 */
export function cageTuples(n: number, cage: Cage): number[][] {
  const out: number[][] = [];
  const vals: number[] = [];
  const cells = cage.cells;
  const rec = (k: number) => {
    if (k === cells.length) {
      if (cageHolds(cage.op, cage.target, vals)) out.push(vals.slice());
      return;
    }
    for (let v = 1; v <= n; v++) {
      let ok = true;
      for (let j = 0; j < k; j++) {
        const same = Math.floor(cells[j] / n) === Math.floor(cells[k] / n) || cells[j] % n === cells[k] % n;
        if (same && vals[j] === v) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // Prune sums and products that already overshoot.
      if (cage.op === '+' && vals.reduce((a, b) => a + b, 0) + v > cage.target) continue;
      if (cage.op === '×' && cage.target % v !== 0) continue;
      vals.push(v);
      rec(k + 1);
      vals.pop();
    }
  };
  rec(0);
  return out;
}

/**
 * Count solutions (stops at `limit`). Searches cage by cage, always the cage with the fewest
 * tuples that still fit the rows and columns.
 */
export function countSolutions(n: number, cages: Cage[], limit = 2): number {
  const tuples = cages.map((c) => cageTuples(n, c));
  const rows = new Array(n).fill(0);
  const cols = new Array(n).fill(0);
  const done = new Array(cages.length).fill(false);
  let count = 0;
  const fits = (k: number, t: number[]) => cages[k].cells.every((cell, j) => !(rows[Math.floor(cell / n)] & (1 << t[j])) && !(cols[cell % n] & (1 << t[j])));
  const set = (k: number, t: number[], on: boolean) =>
    cages[k].cells.forEach((cell, j) => {
      const b = 1 << t[j];
      if (on) {
        rows[Math.floor(cell / n)] |= b;
        cols[cell % n] |= b;
      } else {
        rows[Math.floor(cell / n)] &= ~b;
        cols[cell % n] &= ~b;
      }
    });
  const rec = (left: number) => {
    if (count >= limit) return;
    if (!left) {
      count++;
      return;
    }
    let best = -1;
    let bestOptions: number[][] = [];
    for (let k = 0; k < cages.length; k++) {
      if (done[k]) continue;
      const options = tuples[k].filter((t) => fits(k, t));
      if (!options.length) return;
      if (best < 0 || options.length < bestOptions.length) {
        best = k;
        bestOptions = options;
        if (options.length === 1) break;
      }
    }
    done[best] = true;
    for (const t of bestOptions) {
      set(best, t, true);
      rec(left - 1);
      set(best, t, false);
      if (count >= limit) break;
    }
    done[best] = false;
  };
  rec(cages.length);
  return count;
}

/** A puzzle with exactly one solution. */
export function generate(n: number, rng: Rng): Puzzle {
  for (;;) {
    const solution = latinSquare(n, rng);
    for (let tries = 0; tries < 30; tries++) {
      const cages = makeCages(partition(n, rng), solution, rng);
      if (countSolutions(n, cages) === 1) return { size: n, cages, solution };
    }
  }
}
