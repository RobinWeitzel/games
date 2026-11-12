/**
 * Peg solitaire boards and a solver. A board is a list of holes with grid coordinates and the
 * jumps between them: a peg jumps over a neighbouring peg into an empty hole right behind it,
 * and the jumped peg is removed.
 */

export type BoardId = 'english' | 'triangle';

export interface Hole {
  /** Row and column on the drawing grid (the triangle uses half columns). */
  r: number;
  c: number;
}

export interface Board {
  id: BoardId;
  holes: Hole[];
  /** The hole that starts empty. */
  start: number;
  /** For "perfect" finishes: the last peg should end here (English board). */
  center?: number;
  /** [from, over, to] for every possible jump. */
  jumps: [number, number, number][];
  /** Grid size for drawing. */
  rows: number;
  cols: number;
}

function build(id: BoardId, holes: Hole[], dirs: [number, number][], start: number, rows: number, cols: number, center?: number): Board {
  const at = new Map(holes.map((h, i) => [`${h.r},${h.c}`, i]));
  const jumps: [number, number, number][] = [];
  holes.forEach((h, i) => {
    for (const [dr, dc] of dirs) {
      const over = at.get(`${h.r + dr},${h.c + dc}`);
      const to = at.get(`${h.r + 2 * dr},${h.c + 2 * dc}`);
      if (over != null && to != null) jumps.push([i, over, to]);
    }
  });
  return { id, holes, start, center, jumps, rows, cols };
}

/** The 33-hole cross, centre empty. */
function english(): Board {
  const holes: Hole[] = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if ((r >= 2 && r <= 4) || (c >= 2 && c <= 4)) holes.push({ r, c });
  const center = holes.findIndex((h) => h.r === 3 && h.c === 3);
  return build('english', holes, [[0, 1], [0, -1], [1, 0], [-1, 0]], center, 7, 7, center);
}

/**
 * The 15-hole triangle (rows of 1 to 5), top empty. Columns are in half steps so the rows sit
 * centred: hole k of row r is at column 4 - r + 2k. Jumps go along rows and both diagonals.
 */
function triangle(): Board {
  const holes: Hole[] = [];
  for (let r = 0; r < 5; r++) for (let k = 0; k <= r; k++) holes.push({ r, c: 4 - r + 2 * k });
  return build('triangle', holes, [[0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]], 0, 5, 9);
}

export const BOARDS: Record<BoardId, Board> = { english: english(), triangle: triangle() };

/** Legal jumps for the pegs (true = peg). */
export const legalJumps = (b: Board, pegs: boolean[]) => b.jumps.filter(([f, o, t]) => pegs[f] && pegs[o] && !pegs[t]);

/**
 * Depth-first search for a way down to one peg (on the centre if `perfect`), remembering
 * positions that can't be solved. Returns the jumps, or null if none was found within `budget`.
 */
export function solve(b: Board, start: boolean[], budget = 200000, perfect = false): [number, number, number][] | null {
  const pegs = start.slice();
  const dead = new Set<string>();
  const path: [number, number, number][] = [];
  let left = pegs.filter(Boolean).length;
  let nodes = 0;
  const key = () => pegs.map((p) => (p ? '1' : '0')).join('');
  const rec = (): boolean => {
    if (left === 1) return !perfect || b.center == null || pegs[b.center];
    if (++nodes > budget) return false;
    const k = key();
    if (dead.has(k)) return false;
    for (const j of b.jumps) {
      const [f, o, t] = j;
      if (!pegs[f] || !pegs[o] || pegs[t]) continue;
      pegs[f] = pegs[o] = false;
      pegs[t] = true;
      left--;
      path.push(j);
      if (rec()) return true;
      path.pop();
      left++;
      pegs[f] = pegs[o] = true;
      pegs[t] = false;
      if (nodes > budget) return false;
    }
    dead.add(k);
    return false;
  };
  return rec() ? path.slice() : null;
}
