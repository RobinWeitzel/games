import type { Rng } from '../../core/random';
import { shuffle } from '../../core/random';

/**
 * Slitherlink puzzles: an n × n grid of cells between (n + 1) × (n + 1) dots. Draw one closed
 * loop along the edges between dots, without branches or crossings, so that every number equals
 * the number of loop edges around its cell. Generated puzzles have exactly one solution.
 *
 * Edges: horizontal edge (r, c) for r 0…n, c 0…n−1 is `r * n + c`; vertical edge (r, c) for
 * r 0…n−1, c 0…n is `H + r * (n + 1) + c` with H = (n + 1) * n. Dots: `r * (n + 1) + c`.
 */

export interface Puzzle {
  n: number;
  /** Loop edges around each cell, or -1 for no number. */
  clues: number[];
  /** true for edges of the loop. */
  solution: boolean[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Geometry {
  n: number;
  edges: number;
  /** The four edges of every cell: top, bottom, left, right. */
  cellEdges: number[][];
  /** The two to four edges at every dot. */
  dotEdges: number[][];
  /** The two dots of every edge. */
  edgeDots: [number, number][];
  /** The one or two cells next to every edge. */
  edgeCells: number[][];
}

const geometryCache = new Map<number, Geometry>();

export function geometry(n: number): Geometry {
  let g = geometryCache.get(n);
  if (g) return g;
  const H = (n + 1) * n;
  const h = (r: number, c: number) => r * n + c;
  const v = (r: number, c: number) => H + r * (n + 1) + c;
  const dot = (r: number, c: number) => r * (n + 1) + c;
  const cellEdges: number[][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cellEdges.push([h(r, c), h(r + 1, c), v(r, c), v(r, c + 1)]);
  const dotEdges: number[][] = [];
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c <= n; c++) {
      const out: number[] = [];
      if (c > 0) out.push(h(r, c - 1));
      if (c < n) out.push(h(r, c));
      if (r > 0) out.push(v(r - 1, c));
      if (r < n) out.push(v(r, c));
      dotEdges.push(out);
    }
  }
  const edgeDots: [number, number][] = [];
  const edgeCells: number[][] = [];
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c < n; c++) {
      edgeDots.push([dot(r, c), dot(r, c + 1)]);
      edgeCells.push([r > 0 ? (r - 1) * n + c : -1, r < n ? r * n + c : -1].filter((x) => x >= 0));
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n; c++) {
      edgeDots.push([dot(r, c), dot(r + 1, c)]);
      edgeCells.push([c > 0 ? r * n + c - 1 : -1, c < n ? r * n + c : -1].filter((x) => x >= 0));
    }
  }
  g = { n, edges: 2 * H, cellEdges, dotEdges, edgeDots, edgeCells };
  geometryCache.set(n, g);
  return g;
}

export const isHorizontal = (n: number, e: number) => e < (n + 1) * n;

/** Is `on` exactly one closed loop that satisfies every number? */
export function isValidSolution(n: number, clues: number[], on: boolean[]): boolean {
  const geo = geometry(n);
  if (clues.some((v, c) => v >= 0 && geo.cellEdges[c].filter((e) => on[e]).length !== v)) return false;
  let start = -1;
  let total = 0;
  for (let d = 0; d < geo.dotEdges.length; d++) {
    const deg = geo.dotEdges[d].filter((e) => on[e]).length;
    if (deg !== 0 && deg !== 2) return false;
    if (deg) start = d;
  }
  on.forEach((x) => x && total++);
  if (start < 0) return false;
  // Walk the loop from `start`: it must use every edge that is on.
  let prevEdge = -1;
  let d = start;
  let steps = 0;
  do {
    const e = geo.dotEdges[d].find((x) => on[x] && x !== prevEdge)!;
    const [a, b] = geo.edgeDots[e];
    d = a === d ? b : a;
    prevEdge = e;
    steps++;
  } while (d !== start && steps <= total);
  return steps === total;
}

// ---------- Solver ----------

/**
 * Find up to `limit` solutions. Edges are on, off or unknown. Propagation: numbers (all their
 * remaining edges on or off), dots (a loop passes through with exactly two edges or not at all),
 * no early small loop, and the inside/outside colouring of cells (neighbours across an off edge
 * are on the same side, across an on edge on opposite sides). Then guessing on a way to continue
 * a loop end. `budget` limits the guesses; past it the search reports two solutions ("not unique").
 */
export function solve(n: number, clues: number[], limit = 2, budget = 20000): boolean[][] {
  const geo = geometry(n);
  const E = geo.edges;
  const D = geo.dotEdges.length;
  const C = n * n;
  const OUT = C; // the outside of the grid, as a cell
  const found: boolean[][] = [];
  let nodes = 0;
  const clueCells = clues.map((v, c) => (v >= 0 ? c : -1)).filter((c) => c >= 0);
  /** Cell on the other side of an edge from `cell` (OUT beyond the border). */
  const across = geo.edgeCells.map((cells) => (cells.length === 2 ? cells : [cells[0], OUT]));

  const parent = new Int32Array(D);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };

  const propagate = (val: Int8Array): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      const set = (e: number, v: number): boolean => {
        if (val[e] === v) return true;
        if (val[e] !== -1) return false;
        val[e] = v;
        changed = true;
        return true;
      };
      for (const c of clueCells) {
        let on = 0;
        let unk = 0;
        for (const e of geo.cellEdges[c]) (val[e] === 1 ? on++ : val[e] === -1 ? unk++ : 0);
        const k = clues[c];
        if (on > k || on + unk < k) return false;
        if (unk && on === k) for (const e of geo.cellEdges[c]) if (val[e] === -1) set(e, 0);
        if (unk && on + unk === k) for (const e of geo.cellEdges[c]) if (val[e] === -1) set(e, 1);
      }
      for (let d = 0; d < D; d++) {
        let on = 0;
        let unk = 0;
        for (const e of geo.dotEdges[d]) (val[e] === 1 ? on++ : val[e] === -1 ? unk++ : 0);
        if (on > 2 || (on === 1 && !unk)) return false;
        if (!unk) continue;
        if (on === 2 || (on === 0 && unk === 1)) {
          for (const e of geo.dotEdges[d]) if (val[e] === -1) set(e, 0);
        } else if (on === 1 && unk === 1) {
          for (const e of geo.dotEdges[d]) if (val[e] === -1) set(e, 1);
        }
      }
      if (changed) continue;

      // Inside / outside colouring: side[c] relative to a class root; parity union-find on cells.
      const cp = new Int32Array(C + 1);
      const par = new Int8Array(C + 1);
      for (let i = 0; i <= C; i++) cp[i] = i;
      const root = (x: number): [number, number] => {
        let p = 0;
        while (cp[x] !== x) {
          p ^= par[x];
          x = cp[x];
        }
        return [x, p];
      };
      const join = (a: number, b: number, diff: number): boolean => {
        const [ra, pa] = root(a);
        const [rb, pb] = root(b);
        if (ra === rb) return (pa ^ pb) === diff;
        cp[ra] = rb;
        par[ra] = pa ^ pb ^ diff;
        return true;
      };
      for (let e = 0; e < E; e++) if (val[e] !== -1 && !join(across[e][0], across[e][1], val[e])) return false;
      for (let e = 0; e < E; e++) {
        if (val[e] !== -1) continue;
        const [ra, pa] = root(across[e][0]);
        const [rb, pb] = root(across[e][1]);
        if (ra === rb) set(e, pa ^ pb);
      }
      if (changed) continue;
      // Around an inner dot the four cells are never a checkerboard (that would be four edges).
      for (let r = 0; r < n - 1; r++) {
        for (let c = 0; c < n - 1; c++) {
          const quad = [r * n + c, r * n + c + 1, (r + 1) * n + c + 1, (r + 1) * n + c]; // clockwise
          for (let k = 0; k < 4; k++) {
            // Diagonal pair `a`/`a2` the same, `b` on the other side: then `b2` joins `b`.
            const a = quad[k];
            const a2 = quad[(k + 2) % 4];
            const b = quad[(k + 1) % 4];
            const b2 = quad[(k + 3) % 4];
            const [ra, pa] = root(a);
            const [ra2, pa2] = root(a2);
            if (ra !== ra2 || pa !== pa2) continue;
            const [rb, pb] = root(b);
            if (rb !== ra || pb === pa) continue;
            const [rb2] = root(b2);
            if (rb2 === ra) continue;
            if (!join(b2, b, 0)) return false;
          }
        }
      }
      // New colour links become edges (only a set edge counts as a change, so this ends).
      for (let e = 0; e < E; e++) {
        if (val[e] !== -1) continue;
        const [ra, pa] = root(across[e][0]);
        const [rb, pb] = root(across[e][1]);
        if (ra === rb) set(e, pa ^ pb);
      }
      if (changed) continue;

      // Loops: an edge that would close a loop is off, unless that loop would be the whole solution.
      for (let d = 0; d < D; d++) parent[d] = d;
      let onEdges = 0;
      for (let e = 0; e < E; e++) {
        if (val[e] !== 1) continue;
        onEdges++;
        const ra = find(geo.edgeDots[e][0]);
        const rb = find(geo.edgeDots[e][1]);
        // A closed loop already: it must be everything.
        if (ra === rb) return isComplete(val);
        parent[ra] = rb;
      }
      const compEdges = new Int32Array(D);
      for (let e = 0; e < E; e++) if (val[e] === 1) compEdges[find(geo.edgeDots[e][0])]++;
      let unsatisfied = 0;
      const onAround = new Int8Array(C);
      for (const c of clueCells) {
        for (const x of geo.cellEdges[c]) if (val[x] === 1) onAround[c]++;
        if (onAround[c] !== clues[c]) unsatisfied++;
      }
      for (let e = 0; e < E; e++) {
        if (val[e] !== -1) continue;
        const r = find(geo.edgeDots[e][0]);
        if (r !== find(geo.edgeDots[e][1])) continue;
        // Closing is fine only if every on-edge is in this loop and every number is then satisfied.
        let ok = compEdges[r] === onEdges;
        if (ok) {
          let left = unsatisfied;
          for (const c of geo.edgeCells[e]) {
            if (clues[c] < 0) continue;
            if (onAround[c] === clues[c]) left++;
            if (onAround[c] + 1 === clues[c]) left--;
          }
          ok = left === 0;
        }
        if (!ok) set(e, 0);
      }
    }
    return true;
  };

  /** A closed loop was found during propagation: it's a solution if nothing else is on and every number fits. */
  const isComplete = (val: Int8Array): boolean => {
    const on = Array.from(val, (v) => v === 1);
    return isValidSolution(n, clues, on);
  };

  const rec = (val: Int8Array) => {
    if (found.length >= limit || ++nodes > budget) return;
    if (!propagate(val)) return;
    // Done when there's a loop (propagate only lets a closed loop through when it's the whole solution).
    const on = Array.from(val, (v) => v === 1);
    if (on.some(Boolean) && isValidSolution(n, clues, on)) {
      found.push(on);
      return;
    }
    // Guess at a loop end with the fewest ways on; else next to the biggest number.
    let pick = -1;
    let best = 9;
    for (let d = 0; d < D; d++) {
      let o = 0;
      let unk: number[] = [];
      for (const e of geo.dotEdges[d]) val[e] === 1 ? o++ : val[e] === -1 ? unk.push(e) : 0;
      if (o === 1 && unk.length && unk.length < best) {
        best = unk.length;
        pick = unk[0];
      }
      unk = [];
    }
    if (pick < 0) {
      let bestClue = -1;
      for (const c of clueCells) {
        const e = geo.cellEdges[c].find((x) => val[x] === -1);
        if (e != null && clues[c] > bestClue) (bestClue = clues[c]), (pick = e);
      }
    }
    if (pick < 0) pick = val.indexOf(-1);
    if (pick < 0) return;
    for (const v of [1, 0]) {
      const next = val.slice();
      next[pick] = v;
      rec(next);
      if (found.length >= limit) return;
    }
  };

  rec(new Int8Array(E).fill(-1));
  if (nodes > budget && found.length < limit) return [...found, ...Array.from({ length: limit - found.length }, () => [])];
  return found;
}

// ---------- Generator ----------

const SETTINGS: Record<Difficulty, { n: number; inside: number; keep: number }> = {
  easy: { n: 5, inside: 0.5, keep: 0.6 },
  medium: { n: 7, inside: 0.55, keep: 0.2 },
  hard: { n: 9, inside: 0.55, keep: 0 },
};
export const SIZE: Record<Difficulty, number> = { easy: SETTINGS.easy.n, medium: SETTINGS.medium.n, hard: SETTINGS.hard.n };

/**
 * A random loop: the outline of a random region of cells, grown one cell at a time. The region
 * and everything outside it each stay in one piece, and two cells of the region never touch only
 * at a corner, so the outline is one simple loop.
 */
function randomLoop(n: number, share: number, rng: Rng): boolean[] {
  const inside = new Uint8Array(n * n);
  const nb = (i: number) => {
    const r = Math.floor(i / n);
    const c = i % n;
    return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((j) => j >= 0);
  };
  const onBorder = (i: number) => {
    const r = Math.floor(i / n);
    const c = i % n;
    return r === 0 || c === 0 || r === n - 1 || c === n - 1;
  };
  /** Every outside cell reaches the border through outside cells. */
  const outsideOpen = () => {
    const seen = new Uint8Array(n * n);
    const stack: number[] = [];
    for (let i = 0; i < n * n; i++) if (!inside[i] && onBorder(i)) (seen[i] = 1), stack.push(i);
    while (stack.length) for (const j of nb(stack.pop()!)) if (!inside[j] && !seen[j]) (seen[j] = 1), stack.push(j);
    for (let i = 0; i < n * n; i++) if (!inside[i] && !seen[i]) return false;
    return true;
  };
  /** No 2 × 2 block with the region on one diagonal only. */
  const noCornerTouch = (i: number) => {
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 0],
    ]) {
      const r0 = r + dr;
      const c0 = c + dc;
      if (r0 < 0 || c0 < 0 || r0 >= n - 1 || c0 >= n - 1) continue;
      const a = inside[r0 * n + c0];
      const b = inside[r0 * n + c0 + 1];
      const x = inside[(r0 + 1) * n + c0];
      const d = inside[(r0 + 1) * n + c0 + 1];
      if (a === d && b === x && a !== b) return false;
    }
    return true;
  };
  inside[Math.floor(rng() * n * n)] = 1;
  let size = 1;
  const target = Math.round(n * n * share);
  while (size < target) {
    const frontier: number[] = [];
    for (let i = 0; i < n * n; i++) if (!inside[i] && nb(i).some((j) => inside[j])) frontier.push(i);
    let grew = false;
    for (const f of shuffle(frontier, rng)) {
      inside[f] = 1;
      if (noCornerTouch(f) && outsideOpen()) {
        size++;
        grew = true;
        break;
      }
      inside[f] = 0;
    }
    if (!grew) break;
  }
  const geo = geometry(n);
  return geo.edgeCells.map((cells) => {
    const a = inside[cells[0]];
    const b = cells.length === 2 ? inside[cells[1]] : 0;
    return a !== b;
  });
}

/**
 * Guesses allowed while checking a puzzle in the generator: a number is only taken away while
 * the puzzle stays solvable with little guessing (which also keeps generation fast).
 */
const BUDGET = 200;

/**
 * A random loop with every number shown, then numbers taken away in random order while the
 * solution stays unique (more of them on easier puzzles).
 */
export function generate(difficulty: Difficulty, rng: Rng): Puzzle {
  const { n, inside, keep } = SETTINGS[difficulty];
  const geo = geometry(n);
  for (;;) {
    const solution = randomLoop(n, inside, rng);
    const clues = geo.cellEdges.map((es) => es.filter((e) => solution[e]).length);
    if (clues.includes(4)) continue;
    if (solve(n, clues, 2, BUDGET).length !== 1) continue;
    const order = shuffle(
      clues.map((_, c) => c),
      rng,
    );
    const toKeep = Math.round(clues.length * keep);
    for (const c of order.slice(toKeep)) {
      const v = clues[c];
      clues[c] = -1;
      if (solve(n, clues, 2, BUDGET).length !== 1) clues[c] = v;
    }
    return { n, clues, solution };
  }
}
