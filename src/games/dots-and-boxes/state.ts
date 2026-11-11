import { Level, Shape, chooseLine, completes, geometry, lineCount } from './engine';

/**
 * Dots and Boxes against the computer: pure functions, unit-tested in state.test.ts.
 *
 * The whole DotsGame object is persisted (games/game/dots-and-boxes/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type DotsMode = Level;
export const YOU = 1;
export const CPU = 2;

export const SHAPE: Record<DotsMode, Shape> = { easy: { rows: 3, cols: 3 }, medium: { rows: 4, cols: 4 }, hard: { rows: 5, cols: 5 } };

interface Snapshot {
  lines: boolean[];
  owner: number[];
}

export interface DotsGame {
  mode: DotsMode;
  rows: number;
  cols: number;
  lines: boolean[];
  /** Who won each box: 0 nobody yet, 1 you, 2 the computer. */
  owner: number[];
  turn: 1 | 2;
  first: 1 | 2;
  status: 'playing' | 'won' | 'lost' | 'draw';
  /** The last line drawn. */
  last: number | null;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  /** Positions before each of your turns (undo goes back to your turn). */
  history: Snapshot[];
}

export type Action = { type: 'draw'; line: number } | { type: 'cpu'; rng?: () => number } | { type: 'undo' };

export type Event =
  | { kind: 'none' }
  | { kind: 'drawn'; line: number; by: 1 | 2; boxes: number[] }
  | { kind: 'undone' }
  | { kind: 'won' | 'lost' | 'draw' };

export function newGame(mode: DotsMode, first: 1 | 2): DotsGame {
  const s = SHAPE[mode];
  return {
    mode,
    rows: s.rows,
    cols: s.cols,
    lines: new Array(lineCount(s)).fill(false),
    owner: new Array(s.rows * s.cols).fill(0),
    turn: first,
    first,
    status: 'playing',
    last: null,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

export const score = (g: DotsGame, p: number) => g.owner.filter((o) => o === p).length;
export const progress = (g: DotsGame) => g.lines.filter(Boolean).length / g.lines.length;

function draw(g: DotsGame, line: number, by: 1 | 2): [DotsGame, Event] {
  if (g.lines[line]) return [g, { kind: 'none' }];
  const geo = geometry(g);
  const boxes = completes(geo, g.lines, line);
  const lines = g.lines.slice();
  lines[line] = true;
  const owner = g.owner.slice();
  boxes.forEach((b) => (owner[b] = by));
  const history = by === YOU ? [...g.history, { lines: g.lines, owner: g.owner }] : g.history;
  // Completing a box earns another turn.
  const next: DotsGame = { ...g, lines, owner, last: line, turn: boxes.length ? by : ((3 - by) as 1 | 2), touched: true, history };
  if (lines.every(Boolean)) {
    const mine = score(next, YOU);
    const theirs = score(next, CPU);
    const status = mine > theirs ? 'won' : mine < theirs ? 'lost' : 'draw';
    return [{ ...next, status }, { kind: status }];
  }
  return [next, { kind: 'drawn', line, by, boxes }];
}

export function reduce(g: DotsGame, action: Action): [DotsGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'draw':
      if (g.turn !== YOU) return [g, { kind: 'none' }];
      return draw(g, action.line, YOU);
    case 'cpu':
      if (g.turn !== CPU) return [g, { kind: 'none' }];
      return draw(g, chooseLine(g, g.lines, g.mode, action.rng), CPU);
    case 'undo': {
      const prev = g.history[g.history.length - 1];
      if (!prev) return [g, { kind: 'none' }];
      return [{ ...g, ...prev, turn: YOU, last: null, history: g.history.slice(0, -1), undos: g.undos + 1 }, { kind: 'undone' }];
    }
  }
}
