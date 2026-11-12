import type { Rng } from '../../core/random';
import { shuffle } from '../../core/random';

/**
 * Light Up puzzles: a grid of white and black cells. Place bulbs in white cells so that every
 * white cell is lit (a bulb lights its row and column until a black cell stops the light), no
 * bulb lights another, and every black cell with a number touches exactly that many bulbs.
 * Generated puzzles have exactly one solution (checked by `solve`).
 *
 * Cells are numbered row by row: cell = row * n + col.
 */

/** A black cell without a number. */
export const BLACK = -1;
/** A white cell. */
export const WHITE = -2;

export interface Puzzle {
  n: number;
  /** WHITE, BLACK, or 0–4 (a black cell with a number). */
  cells: number[];
  /** Cells with a bulb in the solution, ascending. */
  solution: number[];
}

export const isBlack = (v: number) => v !== WHITE;

/** For every cell, the white cells its bulb would light (not itself), stopping at black cells. */
export function sightLines(n: number, cells: number[]): number[][] {
  return cells.map((v, i) => {
    if (isBlack(v)) return [];
    const out: number[] = [];
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < n && cc >= 0 && cc < n && !isBlack(cells[rr * n + cc]); rr += dr, cc += dc) out.push(rr * n + cc);
    }
    return out;
  });
}

export function neighbours(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((j) => j >= 0);
}

/** Find up to `limit` solutions (bulb cells, ascending). */
export function solve(n: number, cells: number[], limit = 2): number[][] {
  const sight = sightLines(n, cells);
  const whites = cells.map((v, i) => (isBlack(v) ? -1 : i)).filter((i) => i >= 0);
  const numbered = cells.map((v, i) => (v >= 0 ? i : -1)).filter((i) => i >= 0);
  const adj = cells.map((_, i) => neighbours(n, i).filter((j) => !isBlack(cells[j])));
  const found: number[][] = [];

  /** -1 unknown, 0 no bulb, 1 bulb. Tightens in place; false on a contradiction. */
  const propagate = (val: number[]): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      const set = (i: number, v: number) => {
        if (val[i] === v) return true;
        if (val[i] !== -1) return false;
        val[i] = v;
        changed = true;
        return true;
      };
      for (const i of whites) if (val[i] === 1) for (const j of sight[i]) if (!set(j, 0)) return false;
      for (const b of numbered) {
        const k = cells[b];
        let bulbs = 0;
        let open = 0;
        for (const j of adj[b]) (val[j] === 1 ? bulbs++ : val[j] === -1 ? open++ : 0);
        if (bulbs > k || bulbs + open < k) return false;
        if (open && bulbs === k) for (const j of adj[b]) if (val[j] === -1) set(j, 0);
        if (open && bulbs + open === k) for (const j of adj[b]) if (val[j] === -1) set(j, 1);
      }
      for (const i of whites) {
        if (val[i] === 1 || sight[i].some((j) => val[j] === 1)) continue;
        const can = [i, ...sight[i]].filter((j) => val[j] === -1);
        if (!can.length) return false;
        if (can.length === 1 && !set(can[0], 1)) return false;
      }
    }
    return true;
  };

  const rec = (val: number[]) => {
    if (found.length >= limit || !propagate(val)) return;
    // Branch on the unlit cell with the fewest ways to be lit.
    let bestCan: number[] | null = null;
    for (const i of whites) {
      if (val[i] === 1 || sight[i].some((j) => val[j] === 1)) continue;
      const can = [i, ...sight[i]].filter((j) => val[j] === -1);
      if (!bestCan || can.length < bestCan.length) bestCan = can;
    }
    if (!bestCan) {
      // Everything is lit; unknown cells stay empty. Check the numbers once more.
      const done = val.map((v) => (v === 1 ? 1 : 0));
      if (numbered.every((b) => adj[b].filter((j) => done[j]).length === cells[b])) found.push(whites.filter((i) => done[i]));
      return;
    }
    for (const j of bestCan) {
      const next = val.slice();
      next[j] = 1;
      rec(next);
      if (found.length >= limit) return;
      // Later branches: this cell has no bulb.
      val = val.slice();
      val[j] = 0;
      if (!propagate(val)) return;
    }
  };
  rec(cells.map((v) => (isBlack(v) ? 0 : -1)));
  return found;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Random black cells (point-symmetric, like printed puzzles), bulbs placed greedily until every
 * white cell is lit, numbers on all black cells; then numbers are taken away while the solution
 * stays unique (fewer numbers on harder puzzles).
 */
export function generate(n: number, difficulty: Difficulty, rng: Rng): Puzzle {
  const keep = { easy: 0.6, medium: 0.3, hard: 0 }[difficulty];
  for (;;) {
    const cells = new Array<number>(n * n).fill(WHITE);
    for (let i = 0; i < Math.ceil((n * n) / 2); i++) {
      if (rng() < 0.2) cells[i] = cells[n * n - 1 - i] = BLACK;
    }
    const sight = sightLines(n, cells);
    const bulbs = new Set<number>();
    const lit = new Set<number>();
    for (const i of shuffle(cells.map((_, k) => k), rng)) {
      if (isBlack(cells[i]) || lit.has(i)) continue;
      bulbs.add(i);
      lit.add(i);
      sight[i].forEach((j) => lit.add(j));
    }
    for (let i = 0; i < n * n; i++) if (isBlack(cells[i])) cells[i] = neighbours(n, i).filter((j) => bulbs.has(j)).length;
    if (solve(n, cells).length !== 1) continue;
    // Take numbers away (most of them on hard puzzles) while the solution stays unique.
    const numbered = shuffle(cells.map((v, i) => (v >= 0 ? i : -1)).filter((i) => i >= 0), rng);
    const toKeep = Math.round(numbered.length * keep);
    for (const i of numbered.slice(toKeep)) {
      const v = cells[i];
      cells[i] = BLACK;
      if (solve(n, cells).length !== 1) cells[i] = v;
    }
    return { n, cells, solution: [...bulbs].sort((a, b) => a - b) };
  }
}
