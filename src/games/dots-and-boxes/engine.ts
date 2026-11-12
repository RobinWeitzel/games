/**
 * Dots and Boxes: rules and the computer player. Pure functions, unit-tested in engine.test.ts.
 *
 * A grid of R × C boxes. Lines: first the horizontal ones, (R + 1) rows of C, then the vertical
 * ones, R rows of C + 1. Drawing the fourth side of a box wins it, and the player moves again.
 */

export interface Shape {
  rows: number;
  cols: number;
}

export const lineCount = ({ rows, cols }: Shape) => (rows + 1) * cols + rows * (cols + 1);
export const hLine = (s: Shape, r: number, c: number) => r * s.cols + c;
export const vLine = (s: Shape, r: number, c: number) => (s.rows + 1) * s.cols + r * (s.cols + 1) + c;

/** The four sides of every box. */
export function boxSides(s: Shape): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) out.push([hLine(s, r, c), hLine(s, r + 1, c), vLine(s, r, c), vLine(s, r, c + 1)]);
  return out;
}

/** The boxes (one or two) each line borders. */
export function lineBoxes(s: Shape): number[][] {
  const out: number[][] = Array.from({ length: lineCount(s) }, () => []);
  boxSides(s).forEach((sides, b) => sides.forEach((l) => out[l].push(b)));
  return out;
}

export interface Geometry {
  sides: number[][];
  boxesOf: number[][];
}
const cache = new Map<string, Geometry>();
export function geometry(s: Shape): Geometry {
  const k = `${s.rows}x${s.cols}`;
  let g = cache.get(k);
  if (!g) cache.set(k, (g = { sides: boxSides(s), boxesOf: lineBoxes(s) }));
  return g;
}

/** Sides already drawn around box b. */
const drawnSides = (geo: Geometry, lines: boolean[], b: number) => geo.sides[b].filter((l) => lines[l]).length;

/** Boxes that drawing `line` completes. */
export function completes(geo: Geometry, lines: boolean[], line: number): number[] {
  return geo.boxesOf[line].filter((b) => drawnSides(geo, lines, b) === 3);
}

/** Lines that don't hand the opponent a box (no box gets its third side). */
function safeLines(geo: Geometry, lines: boolean[]): number[] {
  const out: number[] = [];
  lines.forEach((d, l) => {
    if (!d && geo.boxesOf[l].every((b) => drawnSides(geo, lines, b) < 2)) out.push(l);
  });
  return out;
}

/** How many boxes the opponent could take in a row after `line` is drawn (greedy). */
function giveaway(geo: Geometry, lines: boolean[], line: number): number {
  const l = lines.slice();
  l[line] = true;
  let taken = 0;
  for (let found = true; found; ) {
    found = false;
    for (let x = 0; x < l.length; x++) {
      if (l[x]) continue;
      const done = completes(geo, l, x).length;
      if (done) {
        l[x] = true;
        taken += done;
        found = true;
      }
    }
  }
  return taken;
}

/**
 * Best score difference (boxes for the player to move minus the other's) with perfect play,
 * by exhaustive search over the `open` lines with a memo indexed by which of them are drawn.
 * Only used when few lines are left. Mutates `lines` while searching (restored on return).
 */
function exact(geo: Geometry, lines: boolean[], open: number[], mask: number, memo: Int16Array): number {
  const hit = memo[mask];
  if (hit !== -32768) return hit;
  let best = -Infinity;
  for (let k = 0; k < open.length; k++) {
    if (mask & (1 << k)) continue;
    const l = open[k];
    const won = completes(geo, lines, l).length;
    lines[l] = true;
    const rest = exact(geo, lines, open, mask | (1 << k), memo);
    lines[l] = false;
    const v = won ? won + rest : -rest;
    if (v > best) best = v;
  }
  const out = best === -Infinity ? 0 : best;
  memo[mask] = out;
  return out;
}

/** Lines left when the hard level starts to search exactly. */
export const EXACT_FROM = 16;

export type Level = 'easy' | 'medium' | 'hard';

/** The computer's line. */
export function chooseLine(s: Shape, lines: boolean[], level: Level, rng: () => number = Math.random): number {
  const geo = geometry(s);
  const open = lines.map((d, l) => (d ? -1 : l)).filter((l) => l >= 0);
  const pick = (ls: number[]) => ls[Math.floor(rng() * ls.length)];
  if (level === 'hard' && open.length <= EXACT_FROM) {
    const memo = new Int16Array(1 << open.length).fill(-32768);
    let best = open[0];
    let bestV = -Infinity;
    const l = lines.slice();
    open.forEach((x, k) => {
      const won = completes(geo, l, x).length;
      l[x] = true;
      const rest = exact(geo, l, open, 1 << k, memo);
      l[x] = false;
      const v = won ? won + rest : -rest;
      if (v > bestV) (bestV = v), (best = x);
    });
    return best;
  }
  const taking = open.filter((l) => completes(geo, lines, l).length);
  if (taking.length && (level !== 'easy' || rng() < 0.7)) return pick(taking);
  const safe = safeLines(geo, lines);
  if (safe.length) return pick(safe);
  if (level === 'easy') return pick(open);
  // Forced to give something away: as little as possible.
  let fewest = Infinity;
  let best: number[] = [];
  for (const l of open) {
    const g = giveaway(geo, lines, l);
    if (g < fewest) (fewest = g), (best = [l]);
    else if (g === fewest) best.push(l);
  }
  return pick(best);
}
