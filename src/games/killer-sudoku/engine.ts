import type { Rng } from '../../core/random';
import { shuffle } from '../../core/random';

/**
 * Killer Sudoku puzzles: a Sudoku without given digits, split into cages. Each cage shows the
 * sum of its digits, and no digit repeats inside a cage. Generated puzzles have exactly one
 * solution (checked by `solve`).
 *
 * Cells are numbered row by row: cell = row * 9 + col.
 */

export interface Cage {
  /** Cells of the cage, ascending (the first one carries the sum). */
  cells: number[];
  sum: number;
}

export interface Puzzle {
  cages: Cage[];
  solution: number[];
}

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** Row, column and box neighbours of every cell. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter((j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))),
);

const ALL = 0b1111111110;
const bitCount = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};

/** A random full Sudoku grid. */
export function randomGrid(rng: Rng): number[] {
  const grid = new Array<number>(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    let used = 0;
    for (const p of PEERS[i]) used |= 1 << grid[p];
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
      if (used & (1 << v)) continue;
      grid[i] = v;
      if (fill(i + 1)) return true;
    }
    grid[i] = 0;
    return false;
  };
  fill(0);
  return grid;
}

/**
 * For a cage of `size` cells summing to `sum`: the union of digits over all sets of distinct
 * digits that fit within `allowed` (bitmask), and which digits every such set contains.
 */
function cageDigits(size: number, sum: number, allowed: number): { any: number; must: number } {
  let any = 0;
  let must = ALL;
  let found = false;
  const rec = (start: number, left: number, total: number, set: number) => {
    if (left === 0) {
      if (total === sum) {
        any |= set;
        must &= set;
        found = true;
      }
      return;
    }
    for (let d = start; d <= 9; d++) {
      if (total + d > sum) break;
      if (allowed & (1 << d)) rec(d + 1, left - 1, total + d, set | (1 << d));
    }
  };
  rec(1, size, 0, 0);
  return found ? { any, must } : { any: 0, must: 0 };
}

/**
 * Find up to `limit` solutions by constraint propagation (singles, hidden singles, cage sums)
 * and branching on the cell with the fewest candidates.
 */
export function solve(cages: Cage[], limit = 2): number[][] {
  const cageOf = new Array<number>(81);
  cages.forEach((c, k) => c.cells.forEach((cell) => (cageOf[cell] = k)));
  const units: number[][] = [];
  for (let k = 0; k < 9; k++) {
    units.push(Array.from({ length: 9 }, (_, i) => k * 9 + i));
    units.push(Array.from({ length: 9 }, (_, i) => i * 9 + k));
    units.push(Array.from({ length: 81 }, (_, i) => i).filter((i) => boxOf(i) === k));
  }
  const found: number[][] = [];

  /** Tighten candidates in place; false on a contradiction. */
  const propagate = (cand: number[]): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      // Singles: a fixed digit leaves its peers and its cage.
      for (let i = 0; i < 81; i++) {
        const m = cand[i];
        if (!m) return false;
        if (bitCount(m) !== 1) continue;
        for (const p of PEERS[i]) {
          if (cand[p] & m) {
            cand[p] &= ~m;
            if (!cand[p]) return false;
            changed = true;
          }
        }
        for (const p of cages[cageOf[i]].cells) {
          if (p !== i && cand[p] & m) {
            cand[p] &= ~m;
            if (!cand[p]) return false;
            changed = true;
          }
        }
      }
      // Hidden singles in rows, columns and boxes.
      for (const u of units) {
        for (let d = 1; d <= 9; d++) {
          const b = 1 << d;
          let where = -1;
          let count = 0;
          for (const i of u) if (cand[i] & b) (where = i), count++;
          if (!count) return false;
          if (count === 1 && cand[where] !== b) {
            cand[where] = b;
            changed = true;
          }
        }
      }
      // Cages: digits must come from sets of distinct digits with the right sum.
      for (const cage of cages) {
        let fixedSum = 0;
        let fixed = 0;
        const open: number[] = [];
        for (const i of cage.cells) {
          if (bitCount(cand[i]) === 1) {
            fixedSum += Math.log2(cand[i]);
            fixed |= cand[i];
          } else open.push(i);
        }
        if (!open.length) {
          if (fixedSum !== cage.sum) return false;
          continue;
        }
        let allowed = 0;
        for (const i of open) allowed |= cand[i];
        allowed &= ~fixed;
        const { any, must } = cageDigits(open.length, cage.sum - fixedSum, allowed);
        if (!any) return false;
        for (const i of open) {
          if (cand[i] & ~any) {
            cand[i] &= any;
            if (!cand[i]) return false;
            changed = true;
          }
        }
        // A digit every set needs, with only one open cell that can take it.
        for (let d = 1; d <= 9; d++) {
          if (!(must & (1 << d))) continue;
          const can = open.filter((i) => cand[i] & (1 << d));
          if (!can.length) return false;
          if (can.length === 1 && cand[can[0]] !== 1 << d) {
            cand[can[0]] = 1 << d;
            changed = true;
          }
        }
      }
    }
    return true;
  };

  const rec = (cand: number[]) => {
    if (found.length >= limit || !propagate(cand)) return;
    let best = -1;
    for (let i = 0; i < 81; i++) {
      const c = bitCount(cand[i]);
      if (c > 1 && (best < 0 || c < bitCount(cand[best]))) best = i;
    }
    if (best < 0) {
      found.push(cand.map((m) => Math.log2(m)));
      return;
    }
    for (let d = 1; d <= 9 && found.length < limit; d++) {
      if (!(cand[best] & (1 << d))) continue;
      const next = cand.slice();
      next[best] = 1 << d;
      rec(next);
    }
  };
  rec(new Array(81).fill(ALL));
  return found;
}

/** Cage sizes per difficulty: bigger cages are harder. */
const SIZES = {
  easy: [2, 2, 2, 3, 3],
  medium: [2, 2, 3, 3, 4],
  hard: [2, 3, 3, 4, 4, 5],
};
export type Difficulty = keyof typeof SIZES;

/** Grow cages over the grid: connected, with no digit twice in a cage. */
export function growCages(solution: number[], difficulty: Difficulty, rng: Rng): Cage[] {
  const id = new Array<number>(81).fill(-1);
  const cages: number[][] = [];
  for (const start of shuffle(Array.from({ length: 81 }, (_, i) => i), rng)) {
    if (id[start] >= 0) continue;
    const want = SIZES[difficulty][Math.floor(rng() * SIZES[difficulty].length)];
    const cells = [start];
    id[start] = cages.length;
    while (cells.length < want) {
      const digits = new Set(cells.map((c) => solution[c]));
      const options: number[] = [];
      for (const c of cells) {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const r = rowOf(c) + dr;
          const cc = colOf(c) + dc;
          const j = r * 9 + cc;
          if (r >= 0 && r < 9 && cc >= 0 && cc < 9 && id[j] < 0 && !digits.has(solution[j])) options.push(j);
        }
      }
      if (!options.length) break;
      const pick = options[Math.floor(rng() * options.length)];
      id[pick] = cages.length;
      cells.push(pick);
    }
    cages.push(cells);
  }
  return toCages(cages, solution);
}

const toCages = (groups: number[][], solution: number[]): Cage[] =>
  groups
    .map((cells) => cells.slice().sort((a, b) => a - b))
    .map((cells) => ({ cells, sum: cells.reduce((s, c) => s + solution[c], 0) }))
    .sort((a, b) => a.cells[0] - b.cells[0]);

/**
 * Split a cage in two connected parts, one of them containing `cell`. Splitting where two
 * solutions differ adds a sum that tells them apart.
 */
function split(cage: Cage, cell: number, solution: number[], rng: Rng): Cage[] | null {
  if (cage.cells.length < 2) return null;
  const inCage = new Set(cage.cells);
  const neighbours = (c: number) => [c - 9, c + 9, colOf(c) > 0 ? c - 1 : -1, colOf(c) < 8 ? c + 1 : -1].filter((j) => j >= 0 && j < 81 && inCage.has(j));
  const connected = (cells: number[]) => {
    const set = new Set(cells);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) for (const j of neighbours(stack.pop()!)) if (set.has(j) && !seen.has(j)) seen.add(j), stack.push(j);
    return seen.size === cells.length;
  };
  // Try parts that grow from the cell, smallest first.
  for (const size of shuffle(Array.from({ length: cage.cells.length - 1 }, (_, k) => k + 1), rng).sort((a, b) => a - b)) {
    const part = [cell];
    while (part.length < size) {
      const options = part.flatMap(neighbours).filter((j) => !part.includes(j));
      if (!options.length) break;
      part.push(options[Math.floor(rng() * options.length)]);
    }
    const rest = cage.cells.filter((c) => !part.includes(c));
    if (part.length === size && rest.length && connected(rest)) return toCages([part, rest], solution);
  }
  return null;
}

/** A puzzle with exactly one solution. */
export function generate(difficulty: Difficulty, rng: Rng): Puzzle {
  for (;;) {
    const solution = randomGrid(rng);
    let cages = growCages(solution, difficulty, rng);
    for (let step = 0; step < 40; step++) {
      const sols = solve(cages, 2);
      if (sols.length === 1) return { cages, solution };
      const other = sols.find((s) => s.some((v, i) => v !== solution[i]));
      if (!other) break;
      const diff = shuffle(other.map((v, i) => (v !== solution[i] ? i : -1)).filter((i) => i >= 0), rng);
      let done = false;
      for (const cell of diff) {
        const k = cages.findIndex((c) => c.cells.includes(cell));
        const parts = split(cages[k], cell, solution, rng);
        if (parts) {
          cages = [...cages.slice(0, k), ...parts, ...cages.slice(k + 1)].sort((a, b) => a.cells[0] - b.cells[0]);
          done = true;
          break;
        }
      }
      if (!done) break;
    }
  }
}
