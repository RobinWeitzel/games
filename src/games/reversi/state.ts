import { Player, chooseMove, count, flips, legalMoves, play, startBoard } from './engine';

/**
 * Reversi game logic against the computer: pure functions, unit-tested in state.test.ts.
 *
 * The whole ReversiGame object is persisted (games/game/reversi/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type ReversiMode = 'easy' | 'medium' | 'hard';

export const LEVEL: Record<ReversiMode, { depth: number; random: number }> = {
  easy: { depth: 1, random: 0.3 },
  medium: { depth: 3, random: 0 },
  hard: { depth: 5, random: 0 },
};

export const YOU: Player = 1;
export const CPU: Player = 2;

export interface ReversiGame {
  mode: ReversiMode;
  board: number[];
  turn: Player;
  first: Player;
  status: 'playing' | 'won' | 'lost' | 'draw';
  /** The last disc placed (and who had to pass, if anyone). */
  last: number | null;
  passed: Player | null;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  /** Boards before each of your moves (undo goes back to your turn). */
  history: number[][];
}

export type Action = { type: 'place'; cell: number } | { type: 'cpu'; rng?: () => number } | { type: 'undo' };

export type Event =
  | { kind: 'none' }
  | { kind: 'invalid'; cell: number }
  | { kind: 'placed'; cell: number; by: Player; flipped: number; passed: Player | null }
  | { kind: 'undone' }
  | { kind: 'won' | 'lost' | 'draw' };

export function newGame(mode: ReversiMode, first: Player): ReversiGame {
  return { mode, board: startBoard(), turn: first, first, status: 'playing', last: null, passed: null, undos: 0, elapsedMs: 0, touched: false, history: [] };
}

export const discsPlaced = (g: ReversiGame) => g.board.filter(Boolean).length;
export const progress = (g: ReversiGame) => (discsPlaced(g) - 4) / 60;

/** Place a disc; then hand the turn over (or keep it, if the other player has to pass), or end the game. */
function place(g: ReversiGame, cell: number, by: Player): [ReversiGame, Event] {
  const turned = flips(g.board, cell, by);
  if (!turned.length) return [g, { kind: 'invalid', cell }];
  const board = play(g.board, cell, by);
  const other = (3 - by) as Player;
  const history = by === YOU ? [...g.history, g.board] : g.history;
  let next: ReversiGame = { ...g, board, last: cell, touched: true, history, passed: null };
  if (legalMoves(board, other).length) next.turn = other;
  else if (legalMoves(board, by).length) next = { ...next, turn: by, passed: other };
  else {
    const mine = count(board, YOU);
    const theirs = count(board, CPU);
    const status = mine > theirs ? 'won' : mine < theirs ? 'lost' : 'draw';
    return [{ ...next, status }, { kind: status }];
  }
  return [next, { kind: 'placed', cell, by, flipped: turned.length, passed: next.passed }];
}

export function reduce(g: ReversiGame, action: Action): [ReversiGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'place':
      if (g.turn !== YOU) return [g, { kind: 'none' }];
      return place(g, action.cell, YOU);
    case 'cpu': {
      if (g.turn !== CPU) return [g, { kind: 'none' }];
      const { depth, random } = LEVEL[g.mode];
      const m = chooseMove(g.board, CPU, depth, random, action.rng);
      if (m < 0) return [{ ...g, turn: YOU, passed: CPU }, { kind: 'none' }];
      return place(g, m, CPU);
    }
    case 'undo': {
      const prev = g.history[g.history.length - 1];
      if (!prev) return [g, { kind: 'none' }];
      return [{ ...g, board: prev, turn: YOU, last: null, passed: null, history: g.history.slice(0, -1), undos: g.undos + 1 }, { kind: 'undone' }];
    }
  }
}
