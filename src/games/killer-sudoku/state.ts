import { Cage, PEERS } from './engine';
import { GridAction, GridEvent, GridRules, NumberGrid, digitCounts, gridProgress, isEditable, reduceGrid } from '../../core/numberGrid';
import type { Difficulty } from './engine';

/**
 * Killer Sudoku game logic. The play logic (digits, notes, mistakes, undo, hints) is shared
 * with other number grids in core/numberGrid.ts; this file adds the cages and Sudoku peers.
 *
 * The whole KillerGame object is persisted (games/game/killer-sudoku/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type KillerMode = Difficulty | 'daily';

export interface KillerGame extends NumberGrid {
  mode: KillerMode;
  difficulty: Difficulty;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  cages: Cage[];
  elapsedMs: number;
}

export type Action = GridAction;
export type Event = GridEvent;
export { digitCounts, isEditable };
export const progress = gridProgress;

export function newGame(p: { mode: KillerMode; difficulty: Difficulty; cages: Cage[]; solution: number[]; date?: string }): KillerGame {
  return {
    mode: p.mode,
    difficulty: p.difficulty,
    ...(p.date ? { date: p.date } : {}),
    size: 9,
    cages: p.cages,
    solution: p.solution,
    values: new Array(81).fill(0),
    notes: new Array(81).fill(0),
    selected: null,
    notesMode: false,
    mistakes: 0,
    hints: 0,
    elapsedMs: 0,
    status: 'playing',
    touched: false,
    undo: [],
  };
}

export const cageOf = (g: KillerGame, cell: number) => g.cages.find((c) => c.cells.includes(cell))!;

function rules(g: KillerGame): GridRules {
  return {
    // Sudoku peers, plus the rest of the cage (no digit twice in a cage).
    peers: (cell) => [...new Set([...PEERS[cell], ...cageOf(g, cell).cells.filter((c) => c !== cell)])],
    group: (cell) => cageOf(g, cell).cells,
    hintOrder: (open) => {
      const left = (cell: number) => cageOf(g, cell).cells.filter((c) => open.includes(c)).length;
      return open.slice().sort((a, b) => left(a) - left(b) || a - b);
    },
  };
}

export const reduce = (g: KillerGame, action: Action): [KillerGame, Event] => reduceGrid(g, action, rules(g));
