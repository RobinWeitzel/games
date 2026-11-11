/**
 * Reversi: rules and the computer player (negamax with alpha-beta pruning, position weights and
 * mobility). Pure functions, unit-tested in engine.test.ts.
 *
 * The board is 8 × 8: cell = row * 8 + col. 0 empty, 1 you, 2 the computer.
 */

export type Player = 1 | 2;
export const N = 8;

const DIRS = [-9, -8, -7, -1, 1, 7, 8, 9];

/** The opponent discs that placing `p` on `cell` would turn over (empty if the move isn't legal). */
export function flips(board: number[], cell: number, p: Player): number[] {
  if (board[cell] !== 0) return [];
  const o = 3 - p;
  const out: number[] = [];
  const r0 = Math.floor(cell / N);
  const c0 = cell % N;
  for (const d of DIRS) {
    const dr = Math.sign(Math.trunc((d + (d > 0 ? 1 : -1)) / N));
    const dc = d - dr * N;
    const line: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === o) {
      line.push(r * N + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === p) out.push(...line);
  }
  return out;
}

export function legalMoves(board: number[], p: Player): number[] {
  const out: number[] = [];
  for (let i = 0; i < N * N; i++) if (board[i] === 0 && flips(board, i, p).length) out.push(i);
  return out;
}

export function startBoard(): number[] {
  const b = new Array(N * N).fill(0);
  b[27] = b[36] = 2;
  b[28] = b[35] = 1;
  return b;
}

export const count = (board: number[], p: Player) => board.filter((v) => v === p).length;

/** Corners are gold, the cells next to them are dangerous, edges are good. */
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

function evaluate(board: number[], p: Player): number {
  const o = (3 - p) as Player;
  let s = 0;
  for (let i = 0; i < N * N; i++) s += board[i] === p ? WEIGHTS[i] : board[i] === o ? -WEIGHTS[i] : 0;
  return s + 5 * (legalMoves(board, p).length - legalMoves(board, o).length);
}

function apply(board: number[], cell: number, p: Player): number[] {
  const next = board.slice();
  next[cell] = p;
  for (const f of flips(board, cell, p)) next[f] = p;
  return next;
}

function negamax(board: number[], p: Player, depth: number, alpha: number, beta: number, passed: boolean): number {
  const o = (3 - p) as Player;
  const moves = legalMoves(board, p);
  if (!moves.length) {
    if (passed) {
      // Game over: the disc count decides.
      const d = count(board, p) - count(board, o);
      return d > 0 ? 10000 + d : d < 0 ? -10000 + d : 0;
    }
    return -negamax(board, o, depth, -beta, -alpha, true);
  }
  if (depth === 0) return evaluate(board, p);
  let best = -Infinity;
  // Good-looking moves first (better pruning).
  moves.sort((a, b) => WEIGHTS[b] - WEIGHTS[a]);
  for (const m of moves) {
    const v = -negamax(apply(board, m, p), o, depth - 1, -beta, -alpha, false);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's move, or -1 if it has to pass. */
export function chooseMove(board: number[], p: Player, depth: number, random = 0, rng: () => number = Math.random): number {
  const moves = legalMoves(board, p);
  if (!moves.length) return -1;
  if (rng() < random) return moves[Math.floor(rng() * moves.length)];
  const o = (3 - p) as Player;
  let best = moves[0];
  let bestV = -Infinity;
  for (const m of moves.sort((a, b) => WEIGHTS[b] - WEIGHTS[a])) {
    const v = -negamax(apply(board, m, p), o, depth - 1, -Infinity, -bestV, false);
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

export { apply as play };
