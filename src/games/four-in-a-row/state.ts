import { COLS, Player, ROWS, chooseMove, dropRow, isFull, winLine } from './engine';

/**
 * Four in a Row game logic against the computer: pure functions, unit-tested in state.test.ts.
 *
 * The whole FourGame object is persisted (games/game/four-in-a-row/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type FourMode = 'easy' | 'medium' | 'hard';

/** How the computer plays per level: moves looked ahead, share of random moves. */
export const LEVEL: Record<FourMode, { depth: number; random: number }> = {
  easy: { depth: 2, random: 0.35 },
  medium: { depth: 4, random: 0 },
  hard: { depth: 8, random: 0 },
};

export const YOU: Player = 1;
export const CPU: Player = 2;

export interface FourGame {
  mode: FourMode;
  /** 0 empty, 1 you, 2 computer; row 0 at the top. */
  board: number[];
  turn: Player;
  /** Who moved first (alternates from game to game). */
  first: Player;
  status: 'playing' | 'won' | 'lost' | 'draw';
  /** The winning four, once someone has them. */
  line: number[] | null;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  /** Cells played, in order (both players). */
  history: number[];
}

export type Action = { type: 'drop'; col: number } | { type: 'cpu'; rng?: () => number } | { type: 'undo' };

export type Event =
  | { kind: 'none' }
  | { kind: 'invalid'; col: number }
  | { kind: 'dropped'; cell: number; by: Player }
  | { kind: 'undone' }
  | { kind: 'won' | 'lost' | 'draw'; cell: number };

export function newGame(mode: FourMode, first: Player): FourGame {
  return { mode, board: new Array(ROWS * COLS).fill(0), turn: first, first, status: 'playing', line: null, undos: 0, elapsedMs: 0, touched: false, history: [] };
}

export const discs = (g: FourGame) => g.history.length;
export const progress = (g: FourGame) => g.history.length / (ROWS * COLS);

function drop(g: FourGame, col: number, by: Player): [FourGame, Event] {
  const r = dropRow(g.board, col);
  if (r < 0) return [g, { kind: 'invalid', col }];
  const cell = r * COLS + col;
  const board = g.board.slice();
  board[cell] = by;
  const next: FourGame = { ...g, board, turn: (3 - by) as Player, touched: true, history: [...g.history, cell] };
  const line = winLine(board, by);
  if (line) {
    const status = by === YOU ? 'won' : 'lost';
    return [{ ...next, status, line }, { kind: status, cell }];
  }
  if (isFull(board)) return [{ ...next, status: 'draw' }, { kind: 'draw', cell }];
  return [next, { kind: 'dropped', cell, by }];
}

export function reduce(g: FourGame, action: Action): [FourGame, Event] {
  if (g.status !== 'playing' && action.type !== 'undo') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'drop':
      if (g.turn !== YOU) return [g, { kind: 'none' }];
      return drop(g, action.col, YOU);
    case 'cpu': {
      if (g.turn !== CPU) return [g, { kind: 'none' }];
      const { depth, random } = LEVEL[g.mode];
      return drop(g, chooseMove(g.board, CPU, depth, random, action.rng), CPU);
    }
    case 'undo': {
      if (g.status !== 'playing') return [g, { kind: 'none' }];
      // Take back your last disc and the computer's answer to it.
      let k = g.history.length - 1;
      while (k >= 0 && g.board[g.history[k]] !== YOU) k--;
      if (k < 0) return [g, { kind: 'none' }];
      const board = g.board.slice();
      for (const c of g.history.slice(k)) board[c] = 0;
      return [{ ...g, board, turn: YOU, history: g.history.slice(0, k), undos: g.undos + 1 }, { kind: 'undone' }];
    }
  }
}
