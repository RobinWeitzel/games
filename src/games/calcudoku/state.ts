import type { Cage } from './engine';

/**
 * Calcudoku game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole CalcudokuGame object is persisted (games/game/calcudoku/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type CalcudokuMode = 'size4' | 'size5' | 'size6' | 'size7' | 'daily';

export const UNDO_LIMIT = 150;

export interface Snapshot {
  values: number[];
  notes: number[];
}

export interface CalcudokuGame {
  mode: CalcudokuMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  size: number;
  cages: Cage[];
  solution: number[];
  /** 0 = empty. */
  values: number[];
  /** Candidate bitmask per cell (bits 1…size). */
  notes: number[];
  selected: number | null;
  notesMode: boolean;
  mistakes: number;
  hints: number;
  elapsedMs: number;
  status: 'playing' | 'won';
  /** The player made a move (an untouched game isn't counted when abandoned). */
  touched: boolean;
  undo: Snapshot[];
}

export type Action =
  | { type: 'select'; cell: number }
  | { type: 'move'; dr: number; dc: number }
  | { type: 'input'; digit: number }
  | { type: 'erase' }
  | { type: 'toggleNotes' }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  /** A correct digit; `cageDone`: its cage is now complete. */
  | { kind: 'correct'; cell: number; cageDone: number[] | null }
  | { kind: 'mistake'; cell: number }
  | { kind: 'won' };

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
const isCorrect = (g: CalcudokuGame, i: number) => g.values[i] !== 0 && g.values[i] === g.solution[i];
/** Cells the player may still change: empty or wrong. */
export const isEditable = (g: CalcudokuGame, i: number) => !isCorrect(g, i);

export const progress = (g: CalcudokuGame) => g.values.filter((v, i) => v === g.solution[i]).length / g.values.length;

/** How many of each digit are correctly placed (index 1…size). */
export function digitCounts(g: CalcudokuGame): number[] {
  const counts = new Array(g.size + 1).fill(0);
  g.values.forEach((v, i) => {
    if (v && v === g.solution[i]) counts[v]++;
  });
  return counts;
}

const snapshot = (g: CalcudokuGame) => [...g.undo, { values: g.values, notes: g.notes }].slice(-UNDO_LIMIT);

/** Cells in the same row or column. */
function peers(g: CalcudokuGame, cell: number): number[] {
  const n = g.size;
  const r = Math.floor(cell / n);
  const c = cell % n;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    if (k !== c) out.push(r * n + k);
    if (k !== r) out.push(k * n + c);
  }
  return out;
}

/** Place the correct digit (input and hint); notes of that digit in its row and column go away. */
function placeCorrect(g: CalcudokuGame, cell: number): [CalcudokuGame, Event] {
  const digit = g.solution[cell];
  const values = g.values.slice();
  values[cell] = digit;
  const notes = g.notes.slice();
  notes[cell] = 0;
  for (const p of peers(g, cell)) notes[p] &= ~(1 << digit);
  const next = { ...g, values, notes };
  if (values.every((v, i) => v === g.solution[i])) return [{ ...next, status: 'won', selected: null }, { kind: 'won' }];
  const cage = cageOf(g, cell);
  const cageDone = cage.cells.every((c) => values[c] === g.solution[c]) ? cage.cells : null;
  return [next, { kind: 'correct', cell, cageDone }];
}

export function reduce(g: CalcudokuGame, action: Action): [CalcudokuGame, Event] {
  const none: Event = { kind: 'none' };
  if (g.status !== 'playing') return [g, none];
  const n = g.size;
  switch (action.type) {
    case 'select':
      return [{ ...g, selected: action.cell }, none];
    case 'move': {
      const cur = g.selected ?? 0;
      const r = (Math.floor(cur / n) + action.dr + n) % n;
      const c = ((cur % n) + action.dc + n) % n;
      return [{ ...g, selected: r * n + c }, none];
    }
    case 'toggleNotes':
      return [{ ...g, notesMode: !g.notesMode }, none];
    case 'input': {
      const i = g.selected;
      const d = action.digit;
      if (i == null || d < 1 || d > n || !isEditable(g, i)) return [g, none];
      if (g.notesMode) {
        if (g.values[i]) return [g, none]; // can't annotate a (wrong) filled cell
        const notes = g.notes.slice();
        notes[i] ^= 1 << d;
        return [{ ...g, notes, undo: snapshot(g), touched: true }, none];
      }
      if (g.values[i] === d) return [g, none];
      const base = { ...g, undo: snapshot(g), touched: true };
      if (d === g.solution[i]) return placeCorrect(base, i);
      const values = g.values.slice();
      values[i] = d;
      const notes = g.notes.slice();
      notes[i] = 0;
      return [{ ...base, values, notes, mistakes: g.mistakes + 1 }, { kind: 'mistake', cell: i }];
    }
    case 'erase': {
      const i = g.selected;
      if (i == null || !isEditable(g, i) || (!g.values[i] && !g.notes[i])) return [g, none];
      const values = g.values.slice();
      const notes = g.notes.slice();
      values[i] = 0;
      notes[i] = 0;
      return [{ ...g, values, notes, undo: snapshot(g), touched: true }, none];
    }
    case 'undo': {
      const last = g.undo[g.undo.length - 1];
      if (!last) return [g, none];
      return [{ ...g, values: last.values, notes: last.notes, undo: g.undo.slice(0, -1) }, none];
    }
    case 'hint': {
      let i = g.selected;
      if (i == null || !isEditable(g, i)) {
        // The open cell in the smallest unfinished cage: the most useful one to know.
        let best = -1;
        let bestSize = 99;
        for (const cage of g.cages) {
          const open = cage.cells.filter((c) => isEditable(g, c));
          if (open.length && open.length < bestSize) {
            best = open[0];
            bestSize = open.length;
          }
        }
        if (best < 0) return [g, none];
        i = best;
      }
      return placeCorrect({ ...g, undo: snapshot(g), hints: g.hints + 1, selected: i, touched: true }, i);
    }
  }
}
