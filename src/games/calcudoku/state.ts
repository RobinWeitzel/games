import type { Cage } from './engine';
import { GridAction, GridEvent, GridRules, NumberGrid, digitCounts, gridProgress, isEditable, reduceGrid } from '../../core/numberGrid';

/**
 * Calcudoku game logic. The play logic (digits, notes, mistakes, undo, hints) is shared with
 * other number grids in core/numberGrid.ts; this file adds the cages.
 *
 * The whole CalcudokuGame object is persisted (games/game/calcudoku/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type CalcudokuMode = 'size4' | 'size5' | 'size6' | 'size7' | 'daily';

export interface CalcudokuGame extends NumberGrid {
  mode: CalcudokuMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  cages: Cage[];
  elapsedMs: number;
}

export type Action = GridAction;
export type Event = GridEvent;
export { digitCounts, isEditable };

export function newGame(p: { mode: CalcudokuMode; size: number; cages: Cage[]; solution: number[]; date?: string }): CalcudokuGame {
  const n = p.size * p.size;
  return {
    mode: p.mode,
    ...(p.date ? { date: p.date } : {}),
    size: p.size,
    cages: p.cages,
    solution: p.solution,
    values: new Array(n).fill(0),
    notes: new Array(n).fill(0),
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

export const cageOf = (g: CalcudokuGame, cell: number) => g.cages.find((c) => c.cells.includes(cell))!;
export const progress = gridProgress;

function rules(g: CalcudokuGame): GridRules {
  const n = g.size;
  return {
    // Same row or column.
    peers(cell) {
      const r = Math.floor(cell / n);
      const c = cell % n;
      const out: number[] = [];
      for (let k = 0; k < n; k++) {
        if (k !== c) out.push(r * n + k);
        if (k !== r) out.push(k * n + c);
      }
      return out;
    },
    group: (cell) => cageOf(g, cell).cells,
    // A hint without a selection: an open cell in the smallest unfinished cage.
    hintOrder: (open) => {
      const left = (cell: number) => cageOf(g, cell).cells.filter((c) => open.includes(c)).length;
      return open.slice().sort((a, b) => left(a) - left(b) || a - b);
    },
  };
}

export const reduce = (g: CalcudokuGame, action: Action): [CalcudokuGame, Event] => reduceGrid(g, action, rules(g));
