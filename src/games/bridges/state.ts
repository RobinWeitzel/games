import { Edge, Island, connected, crosses } from './engine';

/**
 * Bridges game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole BridgesGame object is persisted (games/game/bridges/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type BridgesMode = 'easy' | 'medium' | 'hard' | 'daily';

export const UNDO_LIMIT = 500;

export interface BridgesGame {
  mode: BridgesMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  w: number;
  h: number;
  islands: Island[];
  /** Every place a bridge can go (pairs of islands that see each other). */
  edges: Edge[];
  solution: number[];
  /** Bridges the player built on each edge (0–2). */
  bridges: number[];
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  /** Undo steps: the edge and how many bridges it had before. Most recent last. */
  history: { k: number; prev: number }[];
}

export type Action =
  /** Tap between two islands: 0 → 1 → 2 → 0 bridges. */
  | { type: 'cycle'; edge: number }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'invalid'; edge: number; reason: string }
  /** `completed`: islands that now have exactly their number of bridges. */
  | { kind: 'changed'; edge: number; completed: number[] }
  | { kind: 'undone' }
  | { kind: 'hint'; edge: number | null }
  | { kind: 'won' };

export function newGame(p: { mode: BridgesMode; w: number; h: number; islands: Island[]; edges: Edge[]; solution: number[]; date?: string }): BridgesGame {
  return {
    mode: p.mode,
    ...(p.date ? { date: p.date } : {}),
    w: p.w,
    h: p.h,
    islands: p.islands,
    edges: p.edges,
    solution: p.solution,
    bridges: p.edges.map(() => 0),
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

/** Bridges at every island. */
export function bridgeCounts(g: BridgesGame): number[] {
  const out = g.islands.map(() => 0);
  g.edges.forEach((e, k) => {
    out[e.a] += g.bridges[k];
    out[e.b] += g.bridges[k];
  });
  return out;
}

/** The most bridges an edge can hold: 2, or less if an island's number is smaller. */
export const maxBridges = (g: BridgesGame, k: number) => Math.min(2, g.islands[g.edges[k].a].n, g.islands[g.edges[k].b].n);

/** The built edge this one would cross, if any. */
export function blockedBy(g: BridgesGame, k: number): number | null {
  for (let f = 0; f < g.edges.length; f++) if (g.bridges[f] > 0 && crosses(g.islands, g.edges[k], g.edges[f])) return f;
  return null;
}

export const progress = (g: BridgesGame) => {
  const counts = bridgeCounts(g);
  return g.islands.filter((isl, i) => counts[i] === isl.n).length / g.islands.length;
};

/** Every island has its number and all are connected. */
export function isSolved(g: BridgesGame): boolean {
  const counts = bridgeCounts(g);
  return g.islands.every((isl, i) => counts[i] === isl.n) && connected(g.islands, g.edges, g.bridges);
}

/** The edge in direction (dr, dc) from island `i`, if any. */
export function edgeFrom(g: BridgesGame, i: number, dr: number, dc: number): number | null {
  const isl = g.islands[i];
  let best: number | null = null;
  let bestDist = Infinity;
  g.edges.forEach((e, k) => {
    if (e.a !== i && e.b !== i) return;
    const o = g.islands[e.a === i ? e.b : e.a];
    const vr = Math.sign(o.r - isl.r);
    const vc = Math.sign(o.c - isl.c);
    const d = Math.abs(o.r - isl.r) + Math.abs(o.c - isl.c);
    if (vr === dr && vc === dc && d < bestDist) {
      best = k;
      bestDist = d;
    }
  });
  return best;
}

function setBridges(g: BridgesGame, k: number, value: number, record: boolean): BridgesGame {
  const bridges = g.bridges.slice();
  const prev = bridges[k];
  bridges[k] = value;
  const next: BridgesGame = { ...g, bridges, moves: g.moves + 1, touched: true };
  if (record) next.history = [...g.history, { k, prev }].slice(-UNDO_LIMIT);
  if (isSolved(next)) next.status = 'won';
  return next;
}

function changeEvent(g: BridgesGame, next: BridgesGame, k: number): [BridgesGame, Event] {
  if (next.status === 'won') return [next, { kind: 'won' }];
  const before = bridgeCounts(g);
  const after = bridgeCounts(next);
  const e = g.edges[k];
  const completed = [e.a, e.b].filter((i) => after[i] === g.islands[i].n && before[i] !== g.islands[i].n);
  return [next, { kind: 'changed', edge: k, completed }];
}

export function reduce(g: BridgesGame, action: Action): [BridgesGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'cycle': {
      const k = action.edge;
      if (k < 0 || k >= g.edges.length) return [g, { kind: 'none' }];
      const cur = g.bridges[k];
      const value = cur >= maxBridges(g, k) ? 0 : cur + 1;
      if (cur === 0 && value > 0 && blockedBy(g, k) != null) return [g, { kind: 'invalid', edge: k, reason: 'Bridges can’t cross' }];
      return changeEvent(g, setBridges(g, k, value, true), k);
    }
    case 'undo': {
      const step = g.history[g.history.length - 1];
      if (!step) return [g, { kind: 'none' }];
      const bridges = g.bridges.slice();
      bridges[step.k] = step.prev;
      return [{ ...g, bridges, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true }, { kind: 'undone' }];
    }
    case 'hint': {
      // Take away a wrong bridge first (it may be blocking), else add a missing one.
      let k = g.bridges.findIndex((b, i) => b > g.solution[i]);
      if (k < 0) k = g.bridges.findIndex((b, i) => b < g.solution[i] && blockedBy(g, i) == null);
      const counted = { ...g, hints: g.hints + 1, touched: true };
      if (k < 0) return [counted, { kind: 'hint', edge: null }];
      const [next, ev] = changeEvent(g, setBridges(counted, k, g.solution[k], true), k);
      return [next, ev.kind === 'won' ? ev : { kind: 'hint', edge: k }];
    }
  }
}
