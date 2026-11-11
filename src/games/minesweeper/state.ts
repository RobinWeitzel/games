import type { Rng } from '../../core/random';
import { isSolvable, provablySafe } from './solver';

/**
 * Minesweeper game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole MinesweeperGame object is persisted (games/game/minesweeper/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type MinesweeperMode = 'easy' | 'medium' | 'hard' | 'daily';

/** Board sizes: portrait boards (more rows than columns) so they fill an iPhone screen. */
export const BOARDS: Record<MinesweeperMode, { cols: number; rows: number; mines: number }> = {
  easy: { cols: 8, rows: 10, mines: 10 },
  medium: { cols: 10, rows: 14, mines: 22 },
  hard: { cols: 12, rows: 17, mines: 40 },
  daily: { cols: 10, rows: 14, mines: 22 },
};

/** Cell states in `MinesweeperGame.cells`. */
export const HIDDEN = 0;
export const OPEN = 1;
export const FLAG = 2;

export interface MinesweeperGame {
  mode: MinesweeperMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  cols: number;
  rows: number;
  mineCount: number;
  /** 1 = mine, per cell. Empty until the first cell is opened (so the first tap is always safe). */
  mines: number[];
  /** HIDDEN / OPEN / FLAG per cell. */
  cells: number[];
  status: 'playing' | 'won' | 'lost';
  /** Taps place flags instead of opening cells. */
  flagMode: boolean;
  /** The mine that was opened (lost games). */
  exploded: number | null;
  elapsedMs: number;
  hints: number;
  /** The player made a move (an untouched game isn't counted when abandoned). */
  touched: boolean;
}

export type Action =
  | { type: 'open'; cell: number }
  /** The opposite of a tap (touch and hold): flags in normal mode, opens in flag mode. */
  | { type: 'alt'; cell: number }
  | { type: 'tap'; cell: number }
  | { type: 'toggleFlagMode' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'opened'; cells: number[] }
  | { kind: 'flagged'; cell: number; on: boolean }
  | { kind: 'won' }
  | { kind: 'lost'; cell: number };

export function newGame(mode: MinesweeperMode, date?: string): MinesweeperGame {
  const b = BOARDS[mode];
  return {
    mode,
    ...(date ? { date } : {}),
    cols: b.cols,
    rows: b.rows,
    mineCount: b.mines,
    mines: [],
    cells: new Array(b.cols * b.rows).fill(HIDDEN),
    status: 'playing',
    flagMode: false,
    exploded: null,
    elapsedMs: 0,
    hints: 0,
    touched: false,
  };
}

export function neighbours(g: Pick<MinesweeperGame, 'cols' | 'rows'>, cell: number): number[] {
  const r = Math.floor(cell / g.cols);
  const c = cell % g.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < g.rows && cc >= 0 && cc < g.cols) out.push(rr * g.cols + cc);
    }
  }
  return out;
}

/** Number of mines around a cell. */
export function count(g: MinesweeperGame, cell: number): number {
  return neighbours(g, cell).reduce((n, i) => n + (g.mines[i] ? 1 : 0), 0);
}

/** Place mines anywhere except `safe` and its neighbours, so the first opened cell is a 0. */
export function placeMines(g: MinesweeperGame, safe: number, rng: Rng): number[] {
  const n = g.cols * g.rows;
  const keepClear = new Set([safe, ...neighbours(g, safe)]);
  // Tiny boards (not used by any mode): only keep the cell itself clear.
  if (n - keepClear.size < g.mineCount) {
    keepClear.clear();
    keepClear.add(safe);
  }
  const candidates = [];
  for (let i = 0; i < n; i++) if (!keepClear.has(i)) candidates.push(i);
  const mines = new Array(n).fill(0);
  for (let k = 0; k < g.mineCount; k++) {
    const j = k + Math.floor(rng() * (candidates.length - k));
    [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
    mines[candidates[k]] = 1;
  }
  return mines;
}

/** Practically never reached: boards need about 1–4 tries (see solver.test.ts). */
const MAX_TRIES = 10000;

/**
 * Place mines so the board can be cleared from `safe` by logic alone: no guessing is ever
 * needed (docs/DESIGN.md). Random layouts are tried until the solver clears one.
 */
export function placeSolvableMines(g: MinesweeperGame, safe: number, rng: Rng): number[] {
  for (let i = 0; i < MAX_TRIES; i++) {
    const mines = placeMines(g, safe, rng);
    if (isSolvable({ cols: g.cols, rows: g.rows, mines }, safe)) return mines;
  }
  return placeMines(g, safe, rng);
}

/** Daily challenge: the same board and the same opened start area for everyone on a date. */
export function newDailyGame(date: string, rng: Rng): MinesweeperGame {
  const g = newGame('daily', date);
  const start = Math.floor(rng() * g.cells.length);
  const mines = placeSolvableMines(g, start, rng);
  const [next] = openCells({ ...g, mines }, [start]);
  // The start area isn't the player's move: the clock starts (and leaving counts) with the first tap.
  return { ...next, touched: false };
}

export const safeCells = (g: MinesweeperGame) => g.cols * g.rows - g.mineCount;
export const openCount = (g: MinesweeperGame) => g.cells.reduce((n, s) => n + (s === OPEN ? 1 : 0), 0);
export const flagCount = (g: MinesweeperGame) => g.cells.reduce((n, s) => n + (s === FLAG ? 1 : 0), 0);
/** Shown as "Mines left": mines minus flags (can go negative with too many flags, like the original). */
export const minesLeft = (g: MinesweeperGame) => g.mineCount - flagCount(g);
export const progress = (g: MinesweeperGame) => openCount(g) / safeCells(g);

/**
 * Open cells, flood-filling from 0s. Flagged cells are never opened. Opening a mine loses
 * (the first mine in `cells` is the exploded one); opening the last safe cell wins.
 */
function openCells(g: MinesweeperGame, start: number[]): [MinesweeperGame, Event] {
  const cells = g.cells.slice();
  const opened: number[] = [];
  const hit = start.find((c) => cells[c] === HIDDEN && g.mines[c]);
  if (hit != null) {
    cells[hit] = OPEN;
    return [{ ...g, cells, status: 'lost', exploded: hit, touched: true }, { kind: 'lost', cell: hit }];
  }
  const stack = start.filter((c) => cells[c] === HIDDEN);
  while (stack.length) {
    const c = stack.pop()!;
    if (cells[c] !== HIDDEN) continue;
    cells[c] = OPEN;
    opened.push(c);
    if (count(g, c) === 0) for (const n of neighbours(g, c)) if (cells[n] === HIDDEN) stack.push(n);
  }
  if (!opened.length) return [g, { kind: 'none' }];
  const next = { ...g, cells, touched: true };
  if (openCount(next) === safeCells(next)) {
    // Won: flag every mine, as in the classic game.
    return [{ ...next, status: 'won', cells: cells.map((s, i) => (g.mines[i] ? FLAG : s)) }, { kind: 'won' }];
  }
  return [next, { kind: 'opened', cells: opened }];
}

function open(g: MinesweeperGame, cell: number, rng: Rng): [MinesweeperGame, Event] {
  if (g.cells[cell] !== HIDDEN) return [g, { kind: 'none' }];
  // First open of the game: lay the mines so this cell is safe and the rest needs no guessing.
  const ready = g.mines.length ? g : { ...g, mines: placeSolvableMines(g, cell, rng) };
  return openCells(ready, [cell]);
}

function toggleFlag(g: MinesweeperGame, cell: number): [MinesweeperGame, Event] {
  const s = g.cells[cell];
  if (s === OPEN) return [g, { kind: 'none' }];
  const cells = g.cells.slice();
  cells[cell] = s === FLAG ? HIDDEN : FLAG;
  return [{ ...g, cells, touched: true }, { kind: 'flagged', cell, on: cells[cell] === FLAG }];
}

/**
 * "Chord": tapping an open number whose flags around it match the number opens all its other
 * hidden neighbours (a wrong flag means a mine gets opened).
 */
function chord(g: MinesweeperGame, cell: number): [MinesweeperGame, Event] {
  const ns = neighbours(g, cell);
  const n = count(g, cell);
  if (!n || ns.filter((i) => g.cells[i] === FLAG).length !== n) return [g, { kind: 'none' }];
  return openCells(g, ns.filter((i) => g.cells[i] === HIDDEN));
}

/**
 * A safe hidden cell to reveal as a hint: the next logical step if there is one (a cell that
 * can be proven safe from the open numbers), else one next to the open area, else any safe cell.
 */
export function hintCell(g: MinesweeperGame, rng: Rng): number | null {
  if (!g.mines.length) return null;
  const logical = provablySafe(g, g.cells.map((s) => s === OPEN));
  if (logical.length) return logical[Math.floor(rng() * logical.length)];
  const safe = g.cells.map((s, i) => (s !== OPEN && !g.mines[i] ? i : -1)).filter((i) => i >= 0);
  const frontier = safe.filter((i) => neighbours(g, i).some((n) => g.cells[n] === OPEN));
  const pool = frontier.length ? frontier : safe;
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/** Apply an action. Returns the same object when nothing changed. `rng` lays mines and picks hints. */
export function reduce(g: MinesweeperGame, action: Action, rng: Rng = Math.random): [MinesweeperGame, Event] {
  if (action.type === 'toggleFlagMode') return [{ ...g, flagMode: !g.flagMode }, { kind: 'none' }];
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'open':
      return open(g, action.cell, rng);
    case 'tap':
      if (g.cells[action.cell] === OPEN) return chord(g, action.cell);
      return g.flagMode ? toggleFlag(g, action.cell) : open(g, action.cell, rng);
    case 'alt':
      if (g.cells[action.cell] === OPEN) return chord(g, action.cell);
      return g.flagMode ? open(g, action.cell, rng) : toggleFlag(g, action.cell);
    case 'hint': {
      if (!g.mines.length) {
        // Nothing open yet: open the middle of the board.
        const [next, ev] = open(g, Math.floor(g.rows / 2) * g.cols + Math.floor(g.cols / 2), rng);
        return [{ ...next, hints: g.hints + 1 }, ev];
      }
      const cell = hintCell(g, rng);
      if (cell == null) return [g, { kind: 'none' }];
      // A hint may land on a wrongly flagged cell: unflag it first.
      const base = g.cells[cell] === FLAG ? { ...g, cells: g.cells.map((s, i) => (i === cell ? HIDDEN : s)) } : g;
      const [next, ev] = openCells(base, [cell]);
      return [{ ...next, hints: g.hints + 1 }, ev];
    }
  }
}
