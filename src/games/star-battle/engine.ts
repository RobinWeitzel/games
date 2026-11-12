import type { Rng } from '../../core/random';
import { shuffle } from '../../core/random';

/**
 * Star Battle puzzles: an n × n grid split into n regions. Place `k` stars in every row, every
 * column and every region, with no two stars touching (not even diagonally). Generated puzzles
 * have exactly one solution (checked by `countSolutions`).
 *
 * Cells are numbered row by row: cell = row * n + col.
 */

export interface Puzzle {
  n: number;
  /** Stars per row, column and region. */
  k: number;
  /** Region of every cell (0…n-1). */
  regions: number[];
  /** Cells with a star in the solution, ascending. */
  solution: number[];
}

/** Do two cells touch (including diagonally)? */
export const touching = (n: number, a: number, b: number) =>
  a !== b && Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1 && Math.abs((a % n) - (b % n)) <= 1;

/** All ways to choose `k` columns in a row with no two side by side. */
function rowChoices(n: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) return void out.push(cur.slice());
    for (let c = start; c < n; c++) {
      cur.push(c);
      rec(c + 2, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}

/** Count solutions (stops at `limit`). */
export const countSolutions = (n: number, k: number, regions: number[], limit = 2) => solve(n, k, regions, limit).length;

/** Find up to `limit` solutions (star cells, ascending), row by row. */
export function solve(n: number, k: number, regions: number[], limit = 2): number[][] {
  const choices = rowChoices(n, k);
  const colCount = new Array(n).fill(0);
  const regCount = new Array(n).fill(0);
  // Cells of each region below each row, to know if a region can still get its stars.
  const regLeft: number[][] = Array.from({ length: n + 1 }, () => new Array(n).fill(0));
  for (let r = n - 1; r >= 0; r--) {
    regLeft[r] = regLeft[r + 1].slice();
    for (let c = 0; c < n; c++) regLeft[r][regions[r * n + c]]++;
  }
  let prev: number[] = [];
  const rows: number[][] = [];
  const found: number[][] = [];
  const rec = (r: number) => {
    if (found.length >= limit) return;
    if (r === n) {
      found.push(rows.flatMap((cols, rr) => cols.map((c) => rr * n + c)));
      return;
    }
    for (const cols of choices) {
      let ok = true;
      for (const c of cols) {
        if (colCount[c] >= k || prev.some((p) => Math.abs(p - c) <= 1) || regCount[regions[r * n + c]] >= k) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // Two stars of the row in one region that only allows one more.
      for (const c of cols) regCount[regions[r * n + c]]++;
      for (const c of cols) colCount[c]++;
      let feasible = cols.every((c) => regCount[regions[r * n + c]] <= k);
      // Every region must still be able to reach k stars with the rows below…
      if (feasible) for (let g = 0; g < n && feasible; g++) if (regCount[g] + Math.min(regLeft[r + 1][g], k * 2) < k) feasible = false;
      // …and every column with the rows left.
      if (feasible) for (let c = 0; c < n && feasible; c++) if (colCount[c] + k * Math.ceil((n - r - 1) / 2) < k) feasible = false;
      if (feasible) {
        const save = prev;
        prev = cols;
        rows.push(cols);
        rec(r + 1);
        rows.pop();
        prev = save;
      }
      for (const c of cols) regCount[regions[r * n + c]]--;
      for (const c of cols) colCount[c]--;
      if (found.length >= limit) return;
    }
  };
  rec(0);
  return found;
}

/** A random valid star layout: k per row and column, none touching. */
export function randomStars(n: number, k: number, rng: Rng): number[] | null {
  const choices = rowChoices(n, k);
  const colCount = new Array(n).fill(0);
  const rows: number[][] = [];
  let steps = 0;
  const rec = (r: number): boolean => {
    if (++steps > 20000) return false;
    if (r === n) return colCount.every((x) => x === k);
    for (const cols of shuffle(choices.slice(), rng)) {
      if (cols.some((c) => colCount[c] >= k || (r > 0 && rows[r - 1].some((p) => Math.abs(p - c) <= 1)))) continue;
      // Columns that still need stars must have enough rows left (stars in a column can't be in adjacent rows).
      cols.forEach((c) => colCount[c]++);
      const left = n - r - 1;
      if (colCount.every((x) => k - x <= Math.ceil(left / 2) + (left % 2 === 0 ? 0 : 0))) {
        rows.push(cols);
        if (rec(r + 1)) return true;
        rows.pop();
      }
      cols.forEach((c) => colCount[c]--);
    }
    return false;
  };
  if (!rec(0)) return null;
  return rows.flatMap((cols, r) => cols.map((c) => r * n + c)).sort((a, b) => a - b);
}

/**
 * Grow n regions around the stars: each region starts from k stars (pairs of nearby stars when
 * k = 2) and takes random free neighbours until the grid is full.
 */
export function growRegions(n: number, k: number, stars: number[], rng: Rng): number[] | null {
  const region = new Array<number>(n * n).fill(-1);
  const seeds: number[][] = [];
  if (k === 1) stars.forEach((s) => seeds.push([s]));
  else {
    // Pair each star with its nearest unpaired star.
    const left = shuffle(stars.slice(), rng);
    while (left.length) {
      const a = left.pop()!;
      let best = 0;
      const dist = (b: number) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs((a % n) - (b % n));
      for (let i = 1; i < left.length; i++) if (dist(left[i]) < dist(left[best])) best = i;
      seeds.push([a, left.splice(best, 1)[0]]);
    }
  }
  seeds.forEach((cells, g) => cells.forEach((c) => (region[c] = g)));
  // Pairs need a connecting path first: walk from one star to the other.
  if (k === 2) {
    for (const [g, [a, b]] of seeds.entries()) {
      let cur = a;
      while (cur !== b) {
        const r = Math.floor(cur / n);
        const c = cur % n;
        const br = Math.floor(b / n);
        const bc = b % n;
        const steps: number[] = [];
        if (r !== br) steps.push((r + Math.sign(br - r)) * n + c);
        if (c !== bc) steps.push(r * n + c + Math.sign(bc - c));
        const free = steps.filter((x) => region[x] === -1 || region[x] === g);
        if (!free.length) return null;
        cur = free[Math.floor(rng() * free.length)];
        if (region[cur] === -1) region[cur] = g;
        else if (region[cur] !== g) return null;
      }
    }
  }
  let open = region.filter((x) => x < 0).length;
  while (open) {
    const frontier: [number, number][] = [];
    for (let i = 0; i < n * n; i++) {
      if (region[i] < 0) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && region[rr * n + cc] < 0) frontier.push([rr * n + cc, region[i]]);
      }
    }
    const [cell, g] = frontier[Math.floor(rng() * frontier.length)];
    region[cell] = g;
    open--;
  }
  return region;
}

/** Is region `g` still connected without cell `x`? */
function connectedWithout(n: number, regions: number[], g: number, x: number): boolean {
  const cells = regions.map((r, i) => (r === g && i !== x ? i : -1)).filter((i) => i >= 0);
  if (!cells.length) return false;
  const inRegion = new Set(cells);
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const j of [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1]) {
      if (j >= 0 && inRegion.has(j) && !seen.has(j)) seen.add(j), stack.push(j);
    }
  }
  return seen.size === cells.length;
}

/**
 * Make the solution unique by small changes: while another solution exists, move one of its
 * stars (a cell that is empty in ours) into a neighbouring region. Our stars never move, so
 * our solution stays valid; the other one usually breaks.
 */
function repair(n: number, k: number, regions: number[], stars: number[], rng: Rng, budget = 60): number[] | null {
  const ours = new Set(stars);
  const key = stars.join(',');
  for (let step = 0; step < budget; step++) {
    const sols = solve(n, k, regions, 2);
    if (sols.length === 1) return regions;
    const other = sols.find((s) => s.join(',') !== key);
    if (!other) return null;
    const moves: [number, number][] = [];
    for (const x of other) {
      if (ours.has(x)) continue;
      const r = Math.floor(x / n);
      const c = x % n;
      for (const j of [r > 0 ? x - n : -1, r < n - 1 ? x + n : -1, c > 0 ? x - 1 : -1, c < n - 1 ? x + 1 : -1]) {
        if (j >= 0 && regions[j] !== regions[x]) moves.push([x, regions[j]]);
      }
    }
    shuffle(moves, rng);
    const move = moves.find(([x]) => connectedWithout(n, regions, regions[x], x));
    if (!move) return null;
    regions[move[0]] = move[1];
  }
  return null;
}

/** A puzzle with exactly one solution. */
export function generate(n: number, k: number, rng: Rng): Puzzle {
  for (;;) {
    const stars = randomStars(n, k, rng);
    if (!stars) continue;
    const grown = growRegions(n, k, stars, rng);
    const regions = grown && repair(n, k, grown, stars, rng);
    if (regions) return { n, k, regions, solution: stars };
  }
}
