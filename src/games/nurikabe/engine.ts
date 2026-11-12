import type { Rng } from '../../core/random';
import { shuffle } from '../../core/random';

/**
 * Nurikabe puzzles: shade cells ("sea") so that every number is in an island of unshaded cells
 * of exactly that size, every island has exactly one number, all shaded cells are connected,
 * and no 2 × 2 block is all shaded. Generated puzzles have exactly one solution (`solve`).
 *
 * Cells are numbered row by row: cell = row * n + col.
 */

export interface Puzzle {
  n: number;
  /** Island size for numbered cells, 0 elsewhere. */
  clues: number[];
  /** true for shaded cells in the solution. */
  solution: boolean[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export function neighbours(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

/** Top-left cells of every 2 × 2 block. */
export function blocks(n: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) out.push(r * n + c);
  return out;
}
export const blockCells = (n: number, i: number) => [i, i + 1, i + n, i + n + 1];

/** Connected components of the cells where `inSet` is true. */
export function components(n: number, inSet: (i: number) => boolean): number[][] {
  const seen = new Uint8Array(n * n);
  const out: number[][] = [];
  for (let s = 0; s < n * n; s++) {
    if (seen[s] || !inSet(s)) continue;
    const comp = [s];
    seen[s] = 1;
    for (let k = 0; k < comp.length; k++) {
      for (const j of neighbours(n, comp[k])) if (!seen[j] && inSet(j)) (seen[j] = 1), comp.push(j);
    }
    out.push(comp);
  }
  return out;
}

/** Does a full shading satisfy every rule? */
export function isValidSolution(n: number, clues: number[], sea: boolean[]): boolean {
  if (blocks(n).some((b) => blockCells(n, b).every((c) => sea[c]))) return false;
  if (components(n, (i) => sea[i]).length > 1) return false;
  for (const island of components(n, (i) => !sea[i])) {
    const nums = island.filter((c) => clues[c] > 0);
    if (nums.length !== 1 || clues[nums[0]] !== island.length) return false;
  }
  return true;
}

// ---------- Solver ----------

const UNKNOWN = -2;
const SEA = -1;

/**
 * Find up to `limit` solutions (shaded cells). Cells are sea or belong to one numbered island.
 * Propagation: finished islands are walled in, an island with one way out takes it, cells next
 * to two islands or out of every island's reach are sea, a sea area with one way out takes it,
 * and the last open cell of a 2 × 2 sea block is land. Then it guesses on the way out of the
 * island with the fewest.
 */
export function solve(n: number, clues: number[], limit = 2, budget = 20000): boolean[][] {
  const N = n * n;
  const nums = clues.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  const size = nums.map((i) => clues[i]);
  const totalLand = size.reduce((a, b) => a + b, 0);
  const nbr = Array.from({ length: N }, (_, i) => neighbours(n, i));
  const blk = blocks(n);
  const found: boolean[][] = [];
  let nodes = 0;

  /** Reach of each island over open cells, within the cells it still needs. reach[i] = bitmask-ish list of islands. */
  const reachOf = (own: Int16Array): number[][] => {
    const reach: number[][] = Array.from({ length: N }, () => []);
    const dist = new Int16Array(N);
    for (let k = 0; k < nums.length; k++) {
      const cells: number[] = [];
      for (let i = 0; i < N; i++) if (own[i] === k) cells.push(i);
      const left = size[k] - cells.length;
      dist.fill(-1);
      for (const c of cells) dist[c] = 0;
      for (let q = 0; q < cells.length; q++) {
        const c = cells[q];
        if (dist[c] >= left) continue;
        for (const j of nbr[c]) {
          if (dist[j] >= 0 || own[j] !== UNKNOWN) continue;
          // A cell touching another island can't join this one.
          if (nbr[j].some((x) => own[x] >= 0 && own[x] !== k)) continue;
          dist[j] = dist[c] + 1;
          reach[j].push(k);
          cells.push(j);
        }
      }
    }
    return reach;
  };

  /** Size and open neighbours of every island. */
  const islandsOf = (own: Int16Array) => {
    const count = new Int16Array(nums.length);
    const exits = nums.map(() => new Set<number>());
    for (let i = 0; i < N; i++) {
      const k = own[i];
      if (k < 0) continue;
      count[k]++;
      for (const j of nbr[i]) if (own[j] === UNKNOWN) exits[k].add(j);
    }
    return { count, exits };
  };

  const propagate = (own: Int16Array): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      const set = (i: number, v: number): boolean => {
        if (own[i] === v) return true;
        if (own[i] !== UNKNOWN) return false;
        own[i] = v;
        changed = true;
        return true;
      };
      // Islands: too big, finished (wall in), or with a single way out.
      const { count, exits: allExits } = islandsOf(own);
      for (let k = 0; k < nums.length; k++) {
        if (count[k] > size[k]) return false;
        const exits = allExits[k];
        if (count[k] === size[k]) {
          for (const j of exits) if (!set(j, SEA)) return false;
        } else if (!exits.size) return false;
        else if (exits.size === 1) {
          const [j] = exits;
          if (nbr[j].some((x) => own[x] >= 0 && own[x] !== k)) return false;
          if (!set(j, k)) return false;
        }
      }
      if (changed) continue;
      // Cells touching two islands, and cells no island can reach, are sea.
      const reach = reachOf(own);
      for (let i = 0; i < N; i++) {
        if (own[i] !== UNKNOWN) continue;
        const touching = new Set(nbr[i].filter((x) => own[x] >= 0).map((x) => own[x]));
        if (touching.size > 1 || !reach[i].length) set(i, SEA);
      }
      if (changed) continue;
      // 2 × 2: the last open cell of three sea cells is land; with one island that can reach it, that island's.
      for (const b of blk) {
        const cells = blockCells(n, b);
        const sea = cells.filter((c) => own[c] === SEA).length;
        if (sea === 4) return false;
        if (sea !== 3) continue;
        const open = cells.find((c) => own[c] === UNKNOWN);
        if (open == null) continue;
        if (!reach[open].length) return false;
        if (reach[open].length === 1 && !set(open, reach[open][0])) return false;
      }
      if (changed) continue;
      // The sea must stay connected: a sea area with a single way out takes it.
      let seaCells = 0;
      for (let i = 0; i < N; i++) if (own[i] === SEA) seaCells++;
      if (seaCells > N - totalLand) return false;
      const seaAreas = components(n, (i) => own[i] === SEA);
      if (seaAreas.length > 1) {
        for (const area of seaAreas) {
          const exits = new Set<number>();
          for (const c of area) for (const j of nbr[c]) if (own[j] === UNKNOWN) exits.add(j);
          if (!exits.size) return false;
          if (exits.size === 1) {
            const [j] = exits;
            if (!set(j, SEA)) return false;
            break; // the areas have changed
          }
        }
        if (changed) continue;
        // Every sea cell must be able to reach every other one through sea or open cells.
        if (components(n, (i) => own[i] === SEA || own[i] === UNKNOWN).filter((c) => c.some((i) => own[i] === SEA)).length > 1) return false;
      }
    }
    return true;
  };

  const done = (own: Int16Array) => {
    const sea = Array.from(own, (v) => v === SEA);
    if (isValidSolution(n, clues, sea)) found.push(sea);
  };

  const rec = (own: Int16Array) => {
    if (found.length >= limit || ++nodes > budget || !propagate(own)) return;
    // Branch on a way out of the unfinished island with the fewest.
    let best: number[] | null = null;
    let bestK = -1;
    const { count, exits } = islandsOf(own);
    for (let k = 0; k < nums.length; k++) {
      if (count[k] === size[k]) continue;
      if (!best || exits[k].size < best.length) (best = [...exits[k]]), (bestK = k);
    }
    if (!best) {
      // Every island is finished: the rest is sea.
      const next = own.slice();
      for (let i = 0; i < N; i++) if (next[i] === UNKNOWN) next[i] = SEA;
      if (propagate(next)) done(next);
      return;
    }
    const c = best[0];
    const a = own.slice();
    a[c] = bestK;
    rec(a);
    if (found.length >= limit) return;
    const b = own.slice();
    b[c] = SEA;
    rec(b);
  };

  const own = new Int16Array(N).fill(UNKNOWN);
  nums.forEach((i, k) => (own[i] = k));
  rec(own);
  // Out of budget: report "not unique" rather than a wrong answer.
  if (nodes > budget && found.length < limit) return [...found, ...Array.from({ length: limit - found.length }, () => [])];
  return found;
}

// ---------- Generator ----------

const SETTINGS: Record<Difficulty, { n: number; maxIsland: number; land: number }> = {
  easy: { n: 6, maxIsland: 5, land: 0.4 },
  medium: { n: 8, maxIsland: 7, land: 0.4 },
  hard: { n: 10, maxIsland: 6, land: 0.4 },
};
export const SIZE: Record<Difficulty, number> = { easy: SETTINGS.easy.n, medium: SETTINGS.medium.n, hard: SETTINGS.hard.n };

/**
 * A random solution: islands are grown one cell at a time from random seeds, never touching
 * another island and never cutting the sea in two; then every 2 × 2 sea block gets a land cell.
 */
function randomSolution(n: number, maxIsland: number, landShare: number, rng: Rng): { island: Int16Array; count: number } | null {
  const N = n * n;
  const island = new Int16Array(N).fill(-1); // -1 = sea
  const sizes: number[] = [];
  const seaConnectedWithout = (cell: number) => {
    island[cell] = 9999;
    const ok = components(n, (i) => island[i] === -1).length <= 1;
    island[cell] = -1;
    return ok;
  };
  /** Free of other islands; `seaConnectedWithout` is checked separately (it's the slow part). */
  const fits = (cell: number, k: number) => island[cell] === -1 && neighbours(n, cell).every((j) => island[j] === -1 || island[j] === k);
  const canJoin = (cell: number, k: number) => fits(cell, k) && seaConnectedWithout(cell);

  const addTo = (cell: number, k: number) => {
    island[cell] = k;
    sizes[k]++;
  };
  let land = 0;
  for (const seed of shuffle(Array.from({ length: N }, (_, i) => i), rng)) {
    if (land >= N * landShare) break;
    if (!canJoin(seed, -2)) continue; // touches no island
    const k = sizes.length;
    sizes.push(0);
    addTo(seed, k);
    const target = rng() < 0.2 ? 1 : 2 + Math.floor(rng() * rng() * (maxIsland - 1));
    while (sizes[k] < target) {
      const options = new Set<number>();
      for (let i = 0; i < N; i++) if (island[i] === k) for (const j of neighbours(n, i)) if (fits(j, k)) options.add(j);
      const next = shuffle([...options], rng).find(seaConnectedWithout);
      if (next == null) break;
      addTo(next, k);
    }
    land += sizes[k];
  }
  // Break up 2 × 2 sea blocks.
  for (let guard = 0; guard < N; guard++) {
    const pool = blocks(n).find((b) => blockCells(n, b).every((c) => island[c] === -1));
    if (pool == null) return { island, count: sizes.length };
    let fixed = false;
    // Grow a neighbouring island into the block if possible; a new island of one cell otherwise.
    const touches = (c: number) => neighbours(n, c).some((j) => island[j] >= 0);
    for (const c of shuffle(blockCells(n, pool), rng).sort((a, b) => Number(touches(b)) - Number(touches(a)))) {
      const touching = [...new Set(neighbours(n, c).filter((j) => island[j] >= 0).map((j) => island[j]))];
      if (touching.length > 1) continue;
      const k = touching.length ? touching[0] : sizes.length;
      if (k === sizes.length) sizes.push(0);
      if (sizes[k] >= maxIsland || !canJoin(c, k)) {
        if (k === sizes.length - 1 && sizes[k] === 0) sizes.pop();
        continue;
      }
      addTo(c, k);
      fixed = true;
      break;
    }
    if (!fixed) return null;
  }
  return null;
}

/**
 * A random solution with each island's size written into one random cell of it. While a second
 * solution exists, the numbers of the islands where the two differ move to other cells of their
 * islands; after a few tries a new solution is drawn.
 */
export function generate(difficulty: Difficulty, rng: Rng): Puzzle {
  const { n, maxIsland, land } = SETTINGS[difficulty];
  for (;;) {
    const sol = randomSolution(n, maxIsland, land, rng);
    if (!sol) continue;
    const islands: number[][] = Array.from({ length: sol.count }, () => []);
    sol.island.forEach((k, i) => k >= 0 && islands[k].push(i));
    const solution = Array.from(sol.island, (k) => k < 0);
    const clueAt = islands.map((cells) => (cells.length ? cells[Math.floor(rng() * cells.length)] : -1));
    for (let tries = 0; tries < 8; tries++) {
      const clues = new Array<number>(n * n).fill(0);
      clueAt.forEach((c, k) => c >= 0 && (clues[c] = islands[k].length));
      const other = solve(n, clues, 2, 3000).find((s) => s.length !== n * n || s.some((v, i) => v !== solution[i]));
      if (!other) return { n, clues, solution };
      // Islands at or next to a cell where the solutions differ get their number moved.
      const moved = new Set<number>();
      other.forEach((v, i) => {
        if (other.length === n * n && v === solution[i]) return;
        for (const j of [i, ...neighbours(n, i)]) if (sol.island[j] >= 0) moved.add(sol.island[j]);
      });
      if (other.length !== n * n) islands.forEach((_, k) => moved.add(k));
      for (const k of moved) clueAt[k] = islands[k][Math.floor(rng() * islands[k].length)];
    }
  }
}
