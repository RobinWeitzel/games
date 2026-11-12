import { Difficulty, geometry } from './engine';

/**
 * Slitherlink game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole SlitherlinkGame object is persisted (games/game/slitherlink/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type SlitherlinkMode = Difficulty | 'daily';

export const EMPTY = 0;
/** A loop edge. */
export const LINE = 1;
/** A cross: "no loop here". */
export const CROSS = 2;
export const UNDO_LIMIT = 500;

export interface SlitherlinkGame {
  mode: SlitherlinkMode;
  difficulty: Difficulty;
  date?: string;
  n: number;
  /** Loop edges around each cell, or -1 for no number. */
  clues: number[];
  /** true for edges of the (only) loop. */
  solution: boolean[];
  /** EMPTY, LINE or CROSS per edge (edge numbering in engine.ts). */
  edges: number[];
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  history: { edges: number[]; prev: number[] }[];
}

export type Action =
  /** Tap: empty → line → cross → empty. */
  | { type: 'tap'; edge: number }
  /** A drag from dot to dot: every edge gets `value` (one undo step). */
  | { type: 'paint'; edges: number[]; value: number }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'changed'; line: boolean; mistake: boolean }
  | { kind: 'undone' }
  | { kind: 'hint'; edge: number | null }
  | { kind: 'won' };

export function newGame(p: { mode: SlitherlinkMode; difficulty: Difficulty; n: number; clues: number[]; solution: boolean[]; date?: string }): SlitherlinkGame {
  return {
    mode: p.mode,
    difficulty: p.difficulty,
    ...(p.date ? { date: p.date } : {}),
    n: p.n,
    clues: p.clues,
    solution: p.solution,
    edges: new Array(p.solution.length).fill(EMPTY),
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

export const nextMark = (m: number) => (m + 1) % 3;

/** For every number: 'ok' (exactly that many lines; for a 0, four crosses), 'bad' (too many lines, or too many crosses) or 'open'. */
export function clueStates(g: SlitherlinkGame): Map<number, 'ok' | 'bad' | 'open'> {
  const geo = geometry(g.n);
  const out = new Map<number, 'ok' | 'bad' | 'open'>();
  g.clues.forEach((v, c) => {
    if (v < 0) return;
    const es = geo.cellEdges[c];
    const lines = es.filter((e) => g.edges[e] === LINE).length;
    const crosses = es.filter((e) => g.edges[e] === CROSS).length;
    // A 0 is done once its four sides are crossed (else every 0 would look done from the start).
    const done = v ? lines === v : crosses === 4;
    out.set(c, lines > v || 4 - crosses < v ? 'bad' : done ? 'ok' : 'open');
  });
  return out;
}

/** Dots where lines branch (more than two lines meet). */
export function branches(g: SlitherlinkGame): Set<number> {
  const geo = geometry(g.n);
  const out = new Set<number>();
  geo.dotEdges.forEach((es, d) => {
    if (es.filter((e) => g.edges[e] === LINE).length > 2) out.add(d);
  });
  return out;
}

/** Is there a closed loop among the lines (which, if the puzzle isn't solved, is a wrong one)? */
export function hasClosedLoop(g: SlitherlinkGame): boolean {
  const geo = geometry(g.n);
  const parent = geo.dotEdges.map((_, d) => d);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let e = 0; e < g.edges.length; e++) {
    if (g.edges[e] !== LINE) continue;
    const a = find(geo.edgeDots[e][0]);
    const b = find(geo.edgeDots[e][1]);
    if (a === b) return true;
    parent[a] = b;
  }
  return false;
}

export function progress(g: SlitherlinkGame): number {
  let total = 0;
  let right = 0;
  g.solution.forEach((s, e) => {
    if (!s) return;
    total++;
    if (g.edges[e] === LINE) right++;
  });
  return total ? right / total : 0;
}

/** Solved when the lines are exactly the solution's loop (the puzzle has one solution). */
export const isSolved = (g: SlitherlinkGame) => g.solution.every((s, e) => s === (g.edges[e] === LINE));

function change(g: SlitherlinkGame, edges: number[], values: number[]): SlitherlinkGame {
  const next = g.edges.slice();
  const prev = edges.map((e) => next[e]);
  edges.forEach((e, i) => (next[e] = values[i]));
  const out: SlitherlinkGame = { ...g, edges: next, moves: g.moves + 1, touched: true, history: [...g.history, { edges, prev }].slice(-UNDO_LIMIT) };
  if (isSolved(out)) out.status = 'won';
  return out;
}

function mistakeMade(before: SlitherlinkGame, after: SlitherlinkGame): boolean {
  if (branches(after).size > branches(before).size) return true;
  if (hasClosedLoop(after) && !hasClosedLoop(before)) return true;
  const a = clueStates(before);
  for (const [c, st] of clueStates(after)) if (st === 'bad' && a.get(c) !== 'bad') return true;
  return false;
}

export function reduce(g: SlitherlinkGame, action: Action): [SlitherlinkGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'tap':
      if (action.edge < 0 || action.edge >= g.edges.length) return [g, { kind: 'none' }];
      return reduce(g, { type: 'paint', edges: [action.edge], value: nextMark(g.edges[action.edge]) });
    case 'paint': {
      const edges = [...new Set(action.edges)].filter((e) => e >= 0 && e < g.edges.length && g.edges[e] !== action.value);
      if (!edges.length) return [g, { kind: 'none' }];
      const next = change(g, edges, edges.map(() => action.value));
      if (next.status === 'won') return [next, { kind: 'won' }];
      return [next, { kind: 'changed', line: action.value === LINE, mistake: mistakeMade(g, next) }];
    }
    case 'undo': {
      const step = g.history[g.history.length - 1];
      if (!step) return [g, { kind: 'none' }];
      const edges = g.edges.slice();
      step.edges.forEach((e, i) => (edges[e] = step.prev[i]));
      return [{ ...g, edges, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true }, { kind: 'undone' }];
    }
    case 'hint': {
      const counted = { ...g, hints: g.hints + 1, touched: true };
      // First a wrong mark: a line off the loop, or a cross on it.
      let edge = g.edges.findIndex((m, e) => (m === LINE && !g.solution[e]) || (m === CROSS && g.solution[e]));
      let value = EMPTY;
      if (edge < 0) {
        // Else a missing loop edge: one continuing a line first, else one next to a number.
        const geo = geometry(g.n);
        const missing = g.solution.map((s, e) => (s && g.edges[e] !== LINE ? e : -1)).filter((e) => e >= 0);
        const continues = (e: number) => geo.edgeDots[e].some((d) => geo.dotEdges[d].some((x) => x !== e && g.edges[x] === LINE));
        const byNumber = (e: number) => geo.edgeCells[e].some((c) => g.clues[c] >= 0);
        missing.sort((a, b) => Number(continues(b)) - Number(continues(a)) || Number(byNumber(b)) - Number(byNumber(a)) || a - b);
        edge = missing[0] ?? -1;
        value = LINE;
      }
      if (edge < 0) return [counted, { kind: 'hint', edge: null }];
      const next = change(counted, [edge], [value]);
      return [next, next.status === 'won' ? { kind: 'won' } : { kind: 'hint', edge }];
    }
  }
}
