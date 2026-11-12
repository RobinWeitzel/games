import type { Rng } from '../../core/random';
import { shuffle } from '../../core/random';

/**
 * Kakuro (cross sums) puzzles. An n × n grid of black clue cells and white cells. White cells
 * form runs (across and down, at least two cells). Each run's digits are 1–9, all different,
 * and add up to the clue in the black cell before the run. The top row and left column are
 * always black. Generated puzzles have exactly one solution (checked by `solve`).
 *
 * Cells are numbered row by row: cell = row * n + col.
 */

export interface Run {
  /** The clue cell before the run. */
  clue: number;
  dir: 'across' | 'down';
  cells: number[];
  sum: number;
}

export interface Puzzle {
  n: number;
  /** Digit per white cell, 0 for black cells. */
  solution: number[];
  /** For every black cell: the sum of the run to its right, 0 if none. */
  across: number[];
  /** For every black cell: the sum of the run below it, 0 if none. */
  down: number[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';

/** All runs of a grid (white = true), with sums from `digits` (0 when not given). */
export function findRuns(n: number, white: boolean[], digits?: number[]): Run[] {
  const runs: Run[] = [];
  for (const dir of ['across', 'down'] as const) {
    const step = dir === 'across' ? 1 : n;
    for (let i = 0; i < n * n; i++) {
      if (white[i]) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      const cells: number[] = [];
      for (let k = 1; dir === 'across' ? c + k < n : r + k < n; k++) {
        const j = i + k * step;
        if (!white[j]) break;
        cells.push(j);
      }
      if (cells.length) runs.push({ clue: i, dir, cells, sum: digits ? cells.reduce((s, j) => s + digits[j], 0) : 0 });
    }
  }
  return runs;
}

/** Runs of a puzzle (with its clue sums). */
export function puzzleRuns(p: Puzzle): Run[] {
  const runs = findRuns(p.n, p.solution.map((d) => d > 0));
  for (const run of runs) run.sum = (run.dir === 'across' ? p.across : p.down)[run.clue];
  return runs;
}

// ---------- Digit combinations ----------

const bits = (m: number) => {
  let k = 0;
  for (; m; m &= m - 1) k++;
  return k;
};
const FULL = 0b1111111110; // digits 1–9 as bits 1–9

/** COMBOS[length][sum]: every set of `length` different digits 1–9 adding up to `sum`, as bitmasks. */
export const COMBOS: number[][][] = (() => {
  const out: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
  for (let m = 0; m < 1 << 10; m += 2) {
    let sum = 0;
    for (let d = 1; d <= 9; d++) if (m & (1 << d)) sum += d;
    out[bits(m)][sum].push(m);
  }
  return out;
})();

/** The digits a run of `length` cells adding up to `sum` can use, as a bitmask. */
export function runDigits(length: number, sum: number): number {
  return (COMBOS[length]?.[sum] ?? []).reduce((a, b) => a | b, 0);
}

// ---------- Solver ----------

/**
 * Find up to `limit` solutions (digit per cell, 0 for black). Constraint propagation over the
 * possible digit sets of every run, then guessing on the cell with the fewest candidates.
 */
export function solve(n: number, runs: Run[], limit = 2): number[][] {
  const cellRuns: number[][] = Array.from({ length: n * n }, () => []);
  runs.forEach((run, k) => run.cells.forEach((c) => cellRuns[c].push(k)));
  const whites = cellRuns.map((r, i) => (r.length ? i : -1)).filter((i) => i >= 0);
  const found: number[][] = [];

  const single = (m: number) => m && !(m & (m - 1));
  const digitOf = (m: number) => 31 - Math.clz32(m);

  /** Tighten the candidate masks in place; false on a contradiction. */
  const propagate = (dom: Uint16Array): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (const run of runs) {
        let placed = 0;
        for (const c of run.cells) {
          if (!single(dom[c])) continue;
          if (placed & dom[c]) return false; // a digit twice
          placed |= dom[c];
        }
        let union = 0;
        let required = FULL;
        for (const combo of COMBOS[run.cells.length][run.sum] ?? []) {
          if ((combo & placed) !== placed) continue;
          // Every open cell can take a free digit of the combination, and every free digit fits some open cell.
          const free = combo & ~placed;
          let cover = 0;
          let fits = true;
          for (const c of run.cells) {
            if (single(dom[c])) continue;
            const m = dom[c] & free;
            if (!m) {
              fits = false;
              break;
            }
            cover |= m;
          }
          if (!fits || cover !== free) continue;
          union |= combo;
          required &= combo;
        }
        if (!union) return false;
        for (const c of run.cells) {
          const next = single(dom[c]) ? dom[c] & union : dom[c] & union & ~placed;
          if (!next) return false;
          if (next !== dom[c]) {
            dom[c] = next;
            changed = true;
          }
        }
        // A digit every possible combination needs, that only one cell can take.
        for (let rest = required & ~placed; rest; rest &= rest - 1) {
          const d = rest & -rest;
          let only = -1;
          let count = 0;
          for (const c of run.cells) if (dom[c] & d) (only = c), count++;
          if (!count) return false;
          if (count === 1 && dom[only] !== d) {
            dom[only] = d;
            changed = true;
          }
        }
      }
    }
    return true;
  };

  const rec = (dom: Uint16Array) => {
    if (found.length >= limit || !propagate(dom)) return;
    let best = -1;
    let bestCount = 10;
    for (const c of whites) {
      const k = bits(dom[c]);
      if (k > 1 && k < bestCount) (best = c), (bestCount = k);
    }
    if (best < 0) {
      found.push(Array.from({ length: n * n }, (_, i) => (cellRuns[i].length ? digitOf(dom[i]) : 0)));
      return;
    }
    for (let rest = dom[best]; rest && found.length < limit; rest &= rest - 1) {
      const next = dom.slice();
      next[best] = rest & -rest;
      rec(next);
    }
  };
  const dom = new Uint16Array(n * n);
  for (const c of whites) dom[c] = FULL;
  rec(dom);
  return found;
}

// ---------- Generator ----------

const SETTINGS: Record<Difficulty, { n: number; black: number; maxRun: number }> = {
  easy: { n: 6, black: 0.25, maxRun: 4 },
  medium: { n: 8, black: 0.26, maxRun: 6 },
  hard: { n: 9, black: 0.26, maxRun: 6 },
};

export const SIZE: Record<Difficulty, number> = { easy: SETTINGS.easy.n, medium: SETTINGS.medium.n, hard: SETTINGS.hard.n };

/** Lengths of the across and down run through every white cell. */
function runLengths(n: number, white: boolean[]): { across: number[]; down: number[] } {
  const across = new Array<number>(n * n).fill(0);
  const down = new Array<number>(n * n).fill(0);
  for (const run of findRuns(n, white)) for (const c of run.cells) (run.dir === 'across' ? across : down)[c] = run.cells.length;
  return { across, down };
}

function connected(n: number, white: boolean[]): boolean {
  const start = white.indexOf(true);
  if (start < 0) return false;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const j of [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1]) {
      if (j >= 0 && white[j] && !seen.has(j)) seen.add(j), stack.push(j);
    }
  }
  return seen.size === white.filter(Boolean).length;
}

/** Every white cell is in an across and a down run of 2 to `maxRun` cells, and the white cells are connected. */
function valid(n: number, white: boolean[], maxRun: number): boolean {
  const { across, down } = runLengths(n, white);
  for (let i = 0; i < n * n; i++) if (white[i] && (across[i] < 2 || down[i] < 2 || across[i] > maxRun || down[i] > maxRun)) return false;
  return connected(n, white);
}

/** Like `valid`, but runs may still be too long (while the layout is being built). */
function validShort(n: number, white: boolean[]): boolean {
  const { across, down } = runLengths(n, white);
  for (let i = 0; i < n * n; i++) if (white[i] && (across[i] < 2 || down[i] < 2)) return false;
  return connected(n, white);
}

/** Every row and column below and right of the clue border has a white cell (no wasted lines). */
function usesEveryLine(n: number, white: boolean[]): boolean {
  for (let k = 1; k < n; k++) {
    let row = false;
    let col = false;
    for (let j = 1; j < n; j++) (row ||= white[k * n + j]), (col ||= white[j * n + k]);
    if (!row || !col) return false;
  }
  return true;
}

/** Make cell `i` and its point-symmetric partner black if the layout stays acceptable. */
function tryBlack(n: number, white: boolean[], i: number, ok: (w: boolean[]) => boolean): boolean {
  // (r, c) → (n - r, n - c): point symmetry around the centre of the white area.
  const r = Math.floor(i / n);
  const c = i % n;
  const j = (n - r) * n + (n - c);
  if (!white[i]) return false;
  const was = white[j];
  white[i] = false;
  white[j] = false;
  if (ok(white)) return true;
  white[i] = true;
  white[j] = was;
  return false;
}

/** A layout of black cells: random symmetric pairs that keep every run at least two long, then long runs broken up. */
function layout(n: number, black: number, maxRun: number, rng: Rng): boolean[] | null {
  const white = new Array<boolean>(n * n).fill(false);
  const interior: number[] = [];
  for (let r = 1; r < n; r++) for (let c = 1; c < n; c++) interior.push(r * n + c);
  interior.forEach((i) => (white[i] = true));
  const target = Math.round(interior.length * black);
  let blacks = 0;
  for (const i of shuffle(interior, rng)) {
    if (blacks >= target) break;
    if (tryBlack(n, white, i, (w) => validShort(n, w))) blacks = interior.filter((k) => !white[k]).length;
  }
  for (let guard = 0; guard < 40; guard++) {
    const long = findRuns(n, white).find((run) => run.cells.length > maxRun);
    if (!long) return valid(n, white, maxRun) && usesEveryLine(n, white) ? white : null;
    if (!shuffle(long.cells, rng).some((i) => tryBlack(n, white, i, (w) => validShort(n, w)))) return null;
  }
  return null;
}

/** Random digits 1–9 for the white cells, different within every run (null if stuck). */
function fill(n: number, white: boolean[], rng: Rng): number[] | null {
  const runs = findRuns(n, white);
  const cellRuns: number[][] = Array.from({ length: n * n }, () => []);
  runs.forEach((run, k) => run.cells.forEach((c) => cellRuns[c].push(k)));
  const used = new Array<number>(runs.length).fill(0);
  const digits = new Array<number>(n * n).fill(0);
  const cells = white.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
  let budget = 20000;
  const rec = (k: number): boolean => {
    if (k === cells.length) return true;
    if (--budget < 0) return false;
    const c = cells[k];
    const [a, b] = cellRuns[c];
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
      const bit = 1 << d;
      if (used[a] & bit || used[b] & bit) continue;
      used[a] |= bit;
      used[b] |= bit;
      digits[c] = d;
      if (rec(k + 1)) return true;
      used[a] &= ~bit;
      used[b] &= ~bit;
    }
    digits[c] = 0;
    return false;
  };
  return rec(0) ? digits : null;
}

function toPuzzle(n: number, digits: number[]): Puzzle {
  const across = new Array<number>(n * n).fill(0);
  const down = new Array<number>(n * n).fill(0);
  for (const run of findRuns(n, digits.map((d) => d > 0), digits)) (run.dir === 'across' ? across : down)[run.clue] = run.sum;
  return { n, solution: digits, across, down };
}

/**
 * A random layout of black cells (point-symmetric, like printed puzzles), random digits, and the
 * sums of the runs. While a second solution exists, the digits of up to two cells where the
 * solutions differ are changed (to digits whose sums allow the fewest combinations), and the sums
 * are recomputed. The layout is kept.
 */
export function generate(difficulty: Difficulty, rng: Rng): Puzzle {
  const { n, black, maxRun } = SETTINGS[difficulty];
  for (;;) {
    const white = layout(n, black, maxRun, rng);
    if (!white) continue;
    const digits = fill(n, white, rng);
    if (!digits) continue;
    const runs = findRuns(n, white);
    const cellRuns: number[][] = Array.from({ length: n * n }, () => []);
    runs.forEach((run, k) => run.cells.forEach((c) => cellRuns[c].push(k)));
    const runSum = (run: Run, cell: number, d: number) => run.cells.reduce((t, x) => t + (x === cell ? d : digits[x]), 0);
    for (let tries = 0; tries < 200; tries++) {
      const p = toPuzzle(n, digits);
      const other = solve(n, puzzleRuns(p), 2).find((s) => s.some((d, i) => d !== digits[i]));
      if (!other) return p;
      const diff = other.map((d, i) => (d !== digits[i] ? i : -1)).filter((i) => i >= 0);
      for (const c of shuffle(diff, rng).slice(0, 2)) {
        const used = new Set<number>();
        for (const k of cellRuns[c]) for (const x of runs[k].cells) if (x !== c) used.add(digits[x]);
        const scored = [1, 2, 3, 4, 5, 6, 7, 8, 9]
          .filter((d) => d !== digits[c] && !used.has(d))
          .map((d) => [cellRuns[c].reduce((a, k) => a + COMBOS[runs[k].cells.length][runSum(runs[k], c, d)].length, 0) + rng() * 2, d]);
        if (scored.length) digits[c] = scored.sort((a, b) => a[0] - b[0])[0][1];
      }
    }
  }
}
