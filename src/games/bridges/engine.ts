import type { Rng } from '../../core/random';

/**
 * Bridges puzzles (Hashiwokakero): islands on a grid, each with a number. Connect them with
 * horizontal and vertical bridges so that every island has as many bridges as its number, at
 * most two bridges join the same two islands, bridges never cross, and all islands end up
 * connected. Generated puzzles have exactly one solution (checked by `countSolutions`).
 */

export interface Island {
  r: number;
  c: number;
  /** How many bridges end here. */
  n: number;
}

/** Two islands that see each other in a straight line (a place a bridge can go). `a` < `b`. */
export interface Edge {
  a: number;
  b: number;
}

export interface Puzzle {
  w: number;
  h: number;
  islands: Island[];
  edges: Edge[];
  /** Bridges (0–2) on every edge in the solution. */
  solution: number[];
}

export const isHorizontal = (islands: Island[], e: Edge) => islands[e.a].r === islands[e.b].r;

/** Do two edges cross (one horizontal, one vertical, meeting strictly between their islands)? */
export function crosses(islands: Island[], e: Edge, f: Edge): boolean {
  const eh = isHorizontal(islands, e);
  if (eh === isHorizontal(islands, f)) return false;
  const [h, v] = eh ? [e, f] : [f, e];
  const r = islands[h.a].r;
  const c = islands[v.a].c;
  const [c1, c2] = [islands[h.a].c, islands[h.b].c].sort((x, y) => x - y);
  const [r1, r2] = [islands[v.a].r, islands[v.b].r].sort((x, y) => x - y);
  return r1 < r && r < r2 && c1 < c && c < c2;
}

/** Every pair of islands that see each other: the nearest island to the right and below. */
export function findEdges(w: number, h: number, islands: Island[]): Edge[] {
  const at = new Map<number, number>();
  islands.forEach((isl, i) => at.set(isl.r * w + isl.c, i));
  const out: Edge[] = [];
  islands.forEach((isl, i) => {
    for (let c = isl.c + 1; c < w; c++) {
      const j = at.get(isl.r * w + c);
      if (j != null) {
        out.push({ a: Math.min(i, j), b: Math.max(i, j) });
        break;
      }
    }
    for (let r = isl.r + 1; r < h; r++) {
      const j = at.get(r * w + isl.c);
      if (j != null) {
        out.push({ a: Math.min(i, j), b: Math.max(i, j) });
        break;
      }
    }
  });
  return out;
}

/** For every edge, the edges it crosses. */
export function crossings(islands: Island[], edges: Edge[]): number[][] {
  return edges.map((e) => edges.map((f, k) => (crosses(islands, e, f) ? k : -1)).filter((k) => k >= 0));
}

/** Are all islands connected by the edges with at least one bridge? */
export function connected(islands: Island[], edges: Edge[], bridges: number[]): boolean {
  if (!islands.length) return true;
  const adj: number[][] = islands.map(() => []);
  edges.forEach((e, k) => {
    if (bridges[k] > 0) {
      adj[e.a].push(e.b);
      adj[e.b].push(e.a);
    }
  });
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) for (const j of adj[stack.pop()!]) if (!seen.has(j)) seen.add(j), stack.push(j);
  return seen.size === islands.length;
}

// ---------- Solver ----------

/**
 * Count solutions (stops at `limit`) by bounds propagation and branching: every edge has a
 * lower and upper bound on its bridges, tightened from the island numbers and crossings.
 */
export function countSolutions(w: number, h: number, islands: Island[], limit = 2): number {
  const edges = findEdges(w, h, islands);
  const cross = crossings(islands, edges);
  const byIsland: number[][] = islands.map(() => []);
  edges.forEach((e, k) => {
    byIsland[e.a].push(k);
    byIsland[e.b].push(k);
  });
  let count = 0;

  /** Tighten bounds in place; false if contradictory. */
  const propagate = (lo: number[], hi: number[]): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (let k = 0; k < edges.length; k++) {
        if (lo[k] > 0) {
          for (const f of cross[k]) {
            if (lo[f] > 0) return false;
            if (hi[f] > 0) {
              hi[f] = 0;
              changed = true;
            }
          }
        }
      }
      for (let i = 0; i < islands.length; i++) {
        const ks = byIsland[i];
        let sumLo = 0;
        let sumHi = 0;
        for (const k of ks) {
          sumLo += lo[k];
          sumHi += hi[k];
        }
        const n = islands[i].n;
        if (sumLo > n || sumHi < n) return false;
        for (const k of ks) {
          const newLo = Math.max(lo[k], n - (sumHi - hi[k]));
          const newHi = Math.min(hi[k], n - (sumLo - lo[k]));
          if (newLo > newHi) return false;
          if (newLo !== lo[k] || newHi !== hi[k]) {
            sumLo += newLo - lo[k];
            sumHi += newHi - hi[k];
            lo[k] = newLo;
            hi[k] = newHi;
            changed = true;
          }
        }
      }
    }
    // Everything that could still be built must connect all islands.
    return connected(islands, edges, hi);
  };

  /** No closed group: a set of finished islands not joined to the rest. */
  const isolated = (lo: number[], hi: number[]): boolean => {
    const adj: number[][] = islands.map(() => []);
    edges.forEach((e, k) => {
      if (lo[k] > 0) {
        adj[e.a].push(e.b);
        adj[e.b].push(e.a);
      }
    });
    const seen = new Array(islands.length).fill(false);
    for (let s = 0; s < islands.length; s++) {
      if (seen[s]) continue;
      const group = [s];
      seen[s] = true;
      let open = false;
      for (let q = 0; q < group.length; q++) {
        const i = group[q];
        for (const k of byIsland[i]) if (lo[k] !== hi[k]) open = true;
        for (const j of adj[i]) if (!seen[j]) (seen[j] = true), group.push(j);
      }
      if (!open && group.length < islands.length) return true;
    }
    return false;
  };

  const rec = (lo: number[], hi: number[]) => {
    if (count >= limit) return;
    if (!propagate(lo, hi) || isolated(lo, hi)) return;
    let best = -1;
    for (let k = 0; k < edges.length; k++) if (lo[k] < hi[k] && (best < 0 || hi[k] - lo[k] < hi[best] - lo[best])) best = k;
    if (best < 0) {
      if (connected(islands, edges, lo)) count++;
      return;
    }
    for (let v = hi[best]; v >= lo[best] && count < limit; v--) {
      const l = lo.slice();
      const u = hi.slice();
      l[best] = u[best] = v;
      rec(l, u);
    }
  };
  rec(
    edges.map(() => 0),
    edges.map((e) => Math.min(2, islands[e.a].n, islands[e.b].n)),
  );
  return count;
}

// ---------- Generator ----------

/**
 * Grow a connected network: start with one island, then repeatedly extend a bridge from a
 * random island in a random direction to a new island, never touching other islands or crossing
 * bridges. A few extra bridges between islands that see each other make loops.
 */
function grow(w: number, h: number, target: number, rng: Rng): { islands: Island[]; bridges: [number, number, number][] } | null {
  const cell = new Array<number>(w * h).fill(0); // 0 water, 1 island, 2 horizontal bridge, 3 vertical bridge
  const pos: [number, number][] = [];
  const bridges: [number, number, number][] = [];
  const add = (r: number, c: number) => {
    cell[r * w + c] = 1;
    pos.push([r, c]);
  };
  add(Math.floor(rng() * h), Math.floor(rng() * w));
  const nearIsland = (r: number, c: number) =>
    [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
      const rr = r + dr;
      const cc = c + dc;
      return rr >= 0 && rr < h && cc >= 0 && cc < w && cell[rr * w + cc] === 1;
    });
  for (let attempts = 0; pos.length < target && attempts < target * 60; attempts++) {
    const from = Math.floor(rng() * pos.length);
    const [r0, c0] = pos[from];
    const [dr, dc] = [[-1, 0], [1, 0], [0, -1], [0, 1]][Math.floor(rng() * 4)];
    // How far the bridge can go over open water.
    const free: number[] = [];
    for (let len = 1; ; len++) {
      const r = r0 + dr * len;
      const c = c0 + dc * len;
      if (r < 0 || r >= h || c < 0 || c >= w || cell[r * w + c] !== 0) break;
      free.push(len);
    }
    const options = free.filter((len) => len >= 2 && !nearIsland(r0 + dr * len, c0 + dc * len));
    if (!options.length) continue;
    const len = options[Math.floor(rng() * Math.min(options.length, 4))];
    for (let k = 1; k < len; k++) cell[(r0 + dr * k) * w + (c0 + dc * k)] = dr ? 3 : 2;
    add(r0 + dr * len, c0 + dc * len);
    bridges.push([from, pos.length - 1, rng() < 0.35 ? 2 : 1]);
  }
  if (pos.length < target * 0.8) return null;
  const islands = pos.map(([r, c]) => ({ r, c, n: 0 }));
  // Extra bridges where two islands already see each other and the way is clear.
  const have = new Set(bridges.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`));
  for (const e of findEdges(w, h, islands)) {
    if (have.has(`${e.a},${e.b}`) || rng() > 0.35) continue;
    const [A, B] = [islands[e.a], islands[e.b]];
    const horiz = A.r === B.r;
    let clear = true;
    const from = horiz ? Math.min(A.c, B.c) : Math.min(A.r, B.r);
    const to = horiz ? Math.max(A.c, B.c) : Math.max(A.r, B.r);
    for (let k = from + 1; k < to; k++) if (cell[horiz ? A.r * w + k : k * w + A.c] !== 0) clear = false;
    if (!clear) continue;
    for (let k = from + 1; k < to; k++) cell[horiz ? A.r * w + k : k * w + A.c] = horiz ? 2 : 3;
    bridges.push([e.a, e.b, rng() < 0.35 ? 2 : 1]);
  }
  for (const [a, b, n] of bridges) {
    islands[a].n += n;
    islands[b].n += n;
  }
  return { islands, bridges };
}

/** A puzzle with exactly one solution, about `density` islands per cell. */
export function generate(w: number, h: number, rng: Rng, density = 0.28): Puzzle {
  const target = Math.round(w * h * density);
  for (;;) {
    const g = grow(w, h, target, rng);
    if (!g) continue;
    // Keep the islands in reading order (stable ids for saves and VoiceOver).
    const order = g.islands.map((_, i) => i).sort((x, y) => g.islands[x].r - g.islands[y].r || g.islands[x].c - g.islands[y].c);
    const islands = order.map((i) => g.islands[i]);
    if (countSolutions(w, h, islands) !== 1) continue;
    const edges = findEdges(w, h, islands);
    const newId = new Map(order.map((old, i) => [old, i]));
    const solution = edges.map(() => 0);
    for (const [a, b, n] of g.bridges) {
      const x = newId.get(a)!;
      const y = newId.get(b)!;
      const k = edges.findIndex((e) => e.a === Math.min(x, y) && e.b === Math.max(x, y));
      solution[k] = n;
    }
    return { w, h, islands, edges, solution };
  }
}
