import { ALL, Grid, boxOf, colOf, rowOf } from './board';
import type { Rng } from '../../../core/random';

/**
 * Backtracking solver with bitmasks and "fewest candidates first".
 * Counts solutions up to `limit` (use 2 to test uniqueness).
 * If `rng` is given, digits are tried in random order (used to create full grids).
 */
export function countSolutions(input: Grid, limit = 2, rng?: Rng, out?: Grid): number {
  const grid = input.slice();
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (!v) continue;
    const b = 1 << v;
    if (rows[rowOf(i)] & b || cols[colOf(i)] & b || boxes[boxOf(i)] & b) return 0;
    rows[rowOf(i)] |= b;
    cols[colOf(i)] |= b;
    boxes[boxOf(i)] |= b;
  }

  let count = 0;
  const search = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const mask = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      let c = 0;
      for (let m = mask; m; m &= m - 1) c++;
      if (c < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = c;
        if (c <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (out && count === 1) for (let i = 0; i < 81; i++) out[i] = grid[i];
      return count >= limit;
    }
    if (bestCount === 0) return false;

    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (rng) {
      for (let k = digits.length - 1; k > 0; k--) {
        const j = Math.floor(rng() * (k + 1));
        [digits[k], digits[j]] = [digits[j], digits[k]];
      }
    }
    const r = rowOf(best), c = colOf(best), bx = boxOf(best);
    for (const d of digits) {
      const b = 1 << d;
      grid[best] = d;
      rows[r] |= b;
      cols[c] |= b;
      boxes[bx] |= b;
      if (search()) return true;
      rows[r] &= ~b;
      cols[c] &= ~b;
      boxes[bx] &= ~b;
    }
    grid[best] = 0;
    return false;
  };
  search();
  return count;
}

export function solve(grid: Grid): Grid | null {
  const out: Grid = new Array(81).fill(0);
  return countSolutions(grid, 1, undefined, out) >= 1 ? out : null;
}

export function hasUniqueSolution(grid: Grid): boolean {
  return countSolutions(grid, 2) === 1;
}

export function randomFullGrid(rng: Rng): Grid {
  const out: Grid = new Array(81).fill(0);
  countSolutions(new Array(81).fill(0), 1, rng, out);
  return out;
}
