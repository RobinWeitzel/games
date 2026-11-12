/**
 * Four in a Row: board, rules and the computer player (negamax with alpha-beta pruning and a
 * window-counting evaluation). Pure functions, unit-tested in engine.test.ts.
 *
 * The board is 6 rows × 7 columns, row 0 at the top: cell = row * 7 + col. 0 empty, 1 you,
 * 2 the computer.
 */

export const ROWS = 6;
export const COLS = 7;
export type Player = 1 | 2;

/** Every line of four cells (rows, columns, both diagonals). */
export const WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  const at = (r: number, c: number) => r * COLS + c;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
        if (cells.every(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS)) out.push(cells.map(([rr, cc]) => at(rr, cc)));
      }
  return out;
})();

/** The row a disc dropped in `col` lands in, or -1 if the column is full. */
export function dropRow(board: number[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (!board[r * COLS + col]) return r;
  return -1;
}

export const legalColumns = (board: number[]) => [3, 2, 4, 1, 5, 0, 6].filter((c) => dropRow(board, c) >= 0);

/** The four cells that make a line for `p`, or null. */
export function winLine(board: number[], p: Player): number[] | null {
  return WINDOWS.find((w) => w.every((i) => board[i] === p)) ?? null;
}

export const isFull = (board: number[]) => board.every((v) => v !== 0);

function play(board: number[], col: number, p: Player): number {
  const r = dropRow(board, col);
  board[r * COLS + col] = p;
  return r * COLS + col;
}

/** How good the position is for `p` (positive = good). */
function evaluate(board: number[], p: Player): number {
  const o = (3 - p) as Player;
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board[r * COLS + 3] === p) score += 3;
    else if (board[r * COLS + 3] === o) score -= 3;
  }
  for (const w of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const i of w) (board[i] === p ? mine++ : board[i] === o ? theirs++ : 0);
    if (mine && theirs) continue;
    if (mine === 3) score += 6;
    else if (mine === 2) score += 2;
    if (theirs === 3) score -= 8;
    else if (theirs === 2) score -= 2;
  }
  return score;
}

const WIN = 100000;

function negamax(board: number[], p: Player, depth: number, alpha: number, beta: number, last: number): number {
  const o = (3 - p) as Player;
  // The opponent just played `last`: did that win?
  if (last >= 0 && WINDOWS.some((w) => w.includes(last) && w.every((i) => board[i] === o))) return -WIN - depth;
  const cols = legalColumns(board);
  if (!cols.length) return 0;
  if (depth === 0) return evaluate(board, p);
  let best = -Infinity;
  for (const c of cols) {
    const cell = play(board, c, p);
    const v = -negamax(board, o, depth - 1, -beta, -alpha, cell);
    board[cell] = 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * The computer's column. `depth` is how many moves it looks ahead; `random` (0–1) is how often
 * it plays a random column instead (easy level). `rng` makes it reproducible in tests.
 */
export function chooseMove(board: number[], p: Player, depth: number, random = 0, rng: () => number = Math.random): number {
  const cols = legalColumns(board);
  const o = (3 - p) as Player;
  const b = board.slice();
  // Always take a win and block an immediate loss, at every level.
  for (const c of cols) {
    const cell = play(b, c, p);
    const won = winLine(b, p);
    b[cell] = 0;
    if (won) return c;
  }
  for (const c of cols) {
    const cell = play(b, c, o);
    const lost = winLine(b, o);
    b[cell] = 0;
    if (lost) return c;
  }
  if (rng() < random) return cols[Math.floor(rng() * cols.length)];
  let best = cols[0];
  let bestV = -Infinity;
  for (const c of cols) {
    const cell = play(b, c, p);
    const v = -negamax(b, o, depth - 1, -Infinity, -bestV, cell);
    b[cell] = 0;
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best;
}
