import type { Rng } from '../../core/random';
import { shuffle } from '../../core/random';

/**
 * Numberlink puzzles: pairs of numbered endpoints on a grid. Join each pair with a path through
 * neighbouring cells; paths may not cross or branch, and together they fill every cell.
 *
 * Puzzles are made by covering the grid with random paths and keeping only their endpoints.
 * Any way of joining the pairs that fills the grid counts as solved, so a puzzle doesn't need a
 * unique solution; the generated paths are kept for hints.
 *
 * Cells are numbered row by row: cell = row * n + col.
 */

export interface Puzzle {
  n: number;
  /** For every pair k (0-based): its two endpoints. Shown as the number k + 1. */
  ends: [number, number][];
  /** The generated path of every pair, from ends[k][0] to ends[k][1]. */
  paths: number[][];
}

export function neighbours(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((j) => j >= 0);
}

/**
 * Cover the grid with random paths: start a path in a free cell with the fewest free neighbours
 * and walk on, preferring cells that are about to be cut off. Leftover single cells are attached
 * to the end of a neighbouring path.
 */
function cover(n: number, rng: Rng, maxLen: number): number[][] | null {
  const owner = new Array<number>(n * n).fill(-1);
  const paths: number[][] = [];
  const free = (i: number) => owner[i] < 0;
  const freeDegree = (i: number) => neighbours(n, i).filter(free).length;
  for (;;) {
    const open = owner.map((o, i) => (o < 0 ? i : -1)).filter((i) => i >= 0);
    if (!open.length) break;
    // Start where the grid is tightest (corners, dead ends), so nothing gets stranded.
    const minDeg = Math.min(...open.map(freeDegree));
    const starts = open.filter((i) => freeDegree(i) === minDeg);
    let cur = starts[Math.floor(rng() * starts.length)];
    const path = [cur];
    owner[cur] = paths.length;
    const want = 3 + Math.floor(rng() * (maxLen - 2));
    while (path.length < want) {
      const next = shuffle(neighbours(n, cur).filter(free), rng);
      if (!next.length) break;
      // Prefer cells with few free neighbours (keeps the rest of the grid in one piece)…
      next.sort((a, b) => freeDegree(a) - freeDegree(b));
      // …and don't run alongside the path itself (that makes ambiguous shortcuts).
      const ok = next.filter((j) => neighbours(n, j).filter((k) => owner[k] === paths.length).length === 1);
      const pick = (ok.length ? ok : next)[0];
      if (!ok.length) break;
      cur = pick;
      owner[cur] = paths.length;
      path.push(cur);
    }
    paths.push(path);
  }
  // Attach single cells and pairs to a neighbouring path's end, or give up.
  for (let k = 0; k < paths.length; k++) {
    if (paths[k].length >= 3) continue;
    let merged = false;
    for (const end of [paths[k][0], paths[k][paths[k].length - 1]]) {
      for (const j of neighbours(n, end)) {
        const o = owner[j];
        if (o === k || o < 0 || paths[o].length < 3) continue;
        const p = paths[o];
        const k0 = paths[k];
        if (p[p.length - 1] === j) {
          // Append, starting from the end that touches.
          paths[o] = [...p, ...(end === k0[0] ? k0 : k0.slice().reverse())];
        } else if (p[0] === j) {
          // Prepend, finishing at the end that touches.
          paths[o] = [...(end === k0[0] ? k0.slice().reverse() : k0), ...p];
        } else continue;
        const seg = k0;
        seg.forEach((c) => (owner[c] = o));
        paths[k] = [];
        merged = true;
        break;
      }
      if (merged) break;
    }
    if (!merged) return null;
  }
  return paths.filter((p) => p.length);
}

/** Is `path` a chain of neighbouring cells? */
export function isChain(n: number, path: number[]): boolean {
  return path.every((c, i) => i === 0 || neighbours(n, c).includes(path[i - 1]));
}

/** A puzzle covering an n × n grid with `pairs` paths or so. */
export function generate(n: number, rng: Rng): Puzzle {
  const maxLen = Math.max(4, Math.round(n * 1.6));
  for (;;) {
    const paths = cover(n, rng, maxLen);
    if (!paths || paths.some((p) => !isChain(n, p) || p.length < 3)) continue;
    if (paths.length < n - 1 || paths.length > Math.round(n * 1.5)) continue;
    const order = shuffle(paths.map((_, k) => k), rng);
    const ps = order.map((k) => paths[k]);
    return { n, ends: ps.map((p) => [p[0], p[p.length - 1]]), paths: ps };
  }
}
