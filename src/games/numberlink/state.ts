import { neighbours } from './engine';

/**
 * Numberlink game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole NumberlinkGame object is persisted (games/game/numberlink/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type NumberlinkMode = 'small' | 'medium' | 'large' | 'daily';

export const UNDO_LIMIT = 200;

export interface NumberlinkGame {
  mode: NumberlinkMode;
  date?: string;
  n: number;
  ends: [number, number][];
  /** The generated solution (for hints): one path per pair. */
  solution: number[][];
  /** The player's path per pair, starting at one of its endpoints (empty = not started). */
  paths: number[][];
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  /** Earlier `paths`, most recent last. */
  history: number[][][];
}

export type Action =
  /** A finished drag: the paths as they are now. */
  | { type: 'commit'; paths: number[][] }
  | { type: 'undo' }
  | { type: 'hint' }
  /** Clear one pair's path (double tap on an endpoint). */
  | { type: 'clear'; pair: number };

export type Event = { kind: 'none' } | { kind: 'changed'; joined: number[] } | { kind: 'undone' } | { kind: 'hint'; pair: number | null } | { kind: 'won' };

export function newGame(p: { mode: NumberlinkMode; n: number; ends: [number, number][]; paths: number[][]; date?: string }): NumberlinkGame {
  return {
    mode: p.mode,
    ...(p.date ? { date: p.date } : {}),
    n: p.n,
    ends: p.ends,
    solution: p.paths,
    paths: p.ends.map(() => []),
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

/** Which pair's endpoint is this cell (or -1)? */
export const endpointOf = (ends: [number, number][], cell: number) => ends.findIndex(([a, b]) => a === cell || b === cell);

/** Is the pair joined: its path runs from one endpoint to the other? */
export const isJoined = (g: { ends: [number, number][]; paths: number[][] }, k: number) => {
  const p = g.paths[k];
  const [a, b] = g.ends[k];
  return p.length >= 2 && ((p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a));
};

/** Pair owning each cell (-1 = free). Endpoints always belong to their pair. */
export function owners(n: number, ends: [number, number][], paths: number[][]): number[] {
  const out = new Array<number>(n * n).fill(-1);
  paths.forEach((p, k) => p.forEach((c) => (out[c] = k)));
  ends.forEach(([a, b], k) => (out[a] = out[b] = k));
  return out;
}

export const filled = (g: NumberlinkGame) => owners(g.n, g.ends, g.paths).filter((o) => o >= 0).length;
export const progress = (g: NumberlinkGame) => g.ends.filter((_, k) => isJoined(g, k)).length / g.ends.length;

export const isSolved = (g: NumberlinkGame) =>
  g.ends.every((_, k) => isJoined(g, k)) && new Set(g.paths.flat()).size === g.n * g.n;

/**
 * Start drawing pair `k` from `cell` (an endpoint of k or a cell of its path). Returns the new
 * paths, or null if a drag can't start there.
 */
export function startAt(_n: number, ends: [number, number][], paths: number[][], cell: number): { paths: number[][]; pair: number } | null {
  const e = endpointOf(ends, cell);
  if (e >= 0) {
    const next = paths.slice();
    // From an endpoint: start over from it (unless the path already starts there, then keep its first cell).
    next[e] = [cell];
    return { paths: next, pair: e };
  }
  const k = paths.findIndex((p) => p.includes(cell));
  if (k < 0) return null;
  const next = paths.slice();
  next[k] = paths[k].slice(0, paths[k].indexOf(cell) + 1);
  return { paths: next, pair: k };
}

/**
 * Extend pair `k`'s path into `cell` (a neighbour of its last cell). Moving back over the path
 * shortens it; crossing another path cuts that one; another pair's endpoint blocks. Returns the
 * new paths, or null if the step isn't possible.
 */
export function extend(n: number, ends: [number, number][], paths: number[][], k: number, cell: number): number[][] | null {
  const p = paths[k];
  const head = p[p.length - 1];
  if (head == null || cell === head || !neighbours(n, head).includes(cell)) return null;
  const next = paths.slice();
  const back = p.indexOf(cell);
  if (back >= 0) {
    next[k] = p.slice(0, back + 1);
    return next;
  }
  // Already joined: only moving back is possible.
  if (isJoined({ ends, paths }, k)) return null;
  const e = endpointOf(ends, cell);
  if (e >= 0 && e !== k) return null;
  if (e === k && cell === p[0]) return null;
  const other = paths.findIndex((q, m) => m !== k && q.includes(cell));
  if (other >= 0) next[other] = paths[other].slice(0, paths[other].indexOf(cell));
  next[k] = [...p, cell];
  return next;
}

export function reduce(g: NumberlinkGame, action: Action): [NumberlinkGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  const commit = (paths: number[][], extra: Partial<NumberlinkGame> = {}): NumberlinkGame => {
    const next: NumberlinkGame = { ...g, ...extra, paths, moves: g.moves + 1, touched: true, history: [...g.history, g.paths].slice(-UNDO_LIMIT) };
    if (isSolved(next)) next.status = 'won';
    return next;
  };
  switch (action.type) {
    case 'commit': {
      if (JSON.stringify(action.paths) === JSON.stringify(g.paths)) return [g, { kind: 'none' }];
      // Paths that don't reach anywhere are dropped (a tap on an endpoint).
      const paths = action.paths.map((p) => (p.length < 2 ? [] : p));
      const next = commit(paths);
      if (next.status === 'won') return [next, { kind: 'won' }];
      const joined = g.ends.map((_, k) => k).filter((k) => isJoined(next, k) && !isJoined(g, k));
      return [next, { kind: 'changed', joined }];
    }
    case 'clear': {
      if (!g.paths[action.pair]?.length) return [g, { kind: 'none' }];
      const paths = g.paths.slice();
      paths[action.pair] = [];
      return [commit(paths), { kind: 'changed', joined: [] }];
    }
    case 'undo': {
      const prev = g.history[g.history.length - 1];
      if (!prev) return [g, { kind: 'none' }];
      return [{ ...g, paths: prev, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true }, { kind: 'undone' }];
    }
    case 'hint': {
      // A pair that isn't joined the way the solution joins it: lay its solution path, cutting others.
      const same = (k: number) => JSON.stringify(g.paths[k]) === JSON.stringify(g.solution[k]) || JSON.stringify(g.paths[k]) === JSON.stringify(g.solution[k].slice().reverse());
      const k = g.ends.findIndex((_, i) => !isJoined(g, i) && !same(i));
      const pick = k >= 0 ? k : g.ends.findIndex((_, i) => !same(i));
      if (pick < 0) return [{ ...g, hints: g.hints + 1, touched: true }, { kind: 'hint', pair: null }];
      const cells = new Set(g.solution[pick]);
      const paths = g.paths.map((p, m) => {
        if (m === pick) return g.solution[pick];
        const cut = p.findIndex((c) => cells.has(c));
        return cut < 0 ? p : p.slice(0, cut).length < 2 ? [] : p.slice(0, cut);
      });
      const next = commit(paths, { hints: g.hints + 1 });
      return [next, next.status === 'won' ? { kind: 'won' } : { kind: 'hint', pair: pick }];
    }
  }
}
