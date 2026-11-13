/**
 * Play logic shared by number-grid puzzles with a known solution (Calcudoku, Killer Sudoku):
 * select a cell, enter a digit or toggle a note, erase, undo, hints. A wrong digit counts as a
 * mistake and stays (marked) until the player changes it; correct digits are locked.
 *
 * Pure functions; each game keeps its own state type (which extends NumberGrid) and stores it.
 * The field names here are part of those games' saves: don't rename them.
 */

export const GRID_UNDO_LIMIT = 150;

export interface GridSnapshot {
  values: number[];
  notes: number[];
}

export interface NumberGrid {
  size: number;
  solution: number[];
  /** 0 = empty. */
  values: number[];
  /** Candidate bitmask per cell (bits 1…size). */
  notes: number[];
  selected: number | null;
  notesMode: boolean;
  mistakes: number;
  hints: number;
  status: 'playing' | 'won';
  touched: boolean;
  undo: GridSnapshot[];
}

export type GridAction =
  | { type: 'select'; cell: number }
  | { type: 'move'; dr: number; dc: number }
  | { type: 'input'; digit: number }
  | { type: 'erase' }
  | { type: 'toggleNotes' }
  | { type: 'undo' }
  | { type: 'hint' };

export type GridEvent =
  | { kind: 'none' }
  /** A correct digit; `groupDone`: the cells of its group (cage) if that is now complete. */
  | { kind: 'correct'; cell: number; groupDone: number[] | null }
  | { kind: 'mistake'; cell: number }
  | { kind: 'won' };

export interface GridRules {
  /** Cells that may not repeat the cell's digit (notes of a placed digit are removed there). */
  peers(cell: number): number[];
  /** The cells of the cell's group (cage), to report it complete. */
  group(cell: number): number[];
  /** For a hint without a selection: the cells to choose from, best first (default: reading order). */
  hintOrder?(cells: number[]): number[];
}

const isCorrect = (g: NumberGrid, i: number) => g.values[i] !== 0 && g.values[i] === g.solution[i];
/** Cells the player may still change: empty or wrong. */
export const isEditable = (g: NumberGrid, i: number) => !isCorrect(g, i);

export const gridProgress = (g: NumberGrid) => g.values.filter((v, i) => v === g.solution[i]).length / g.values.length;

/** How many of each digit are correctly placed (index 1…size). */
export function digitCounts(g: NumberGrid): number[] {
  const counts = new Array(g.size + 1).fill(0);
  g.values.forEach((v, i) => {
    if (v && v === g.solution[i]) counts[v]++;
  });
  return counts;
}

const snapshot = (g: NumberGrid) => [...g.undo, { values: g.values, notes: g.notes }].slice(-GRID_UNDO_LIMIT);

function placeCorrect<G extends NumberGrid>(g: G, cell: number, rules: GridRules): [G, GridEvent] {
  const digit = g.solution[cell];
  const values = g.values.slice();
  values[cell] = digit;
  const notes = g.notes.slice();
  notes[cell] = 0;
  for (const p of rules.peers(cell)) notes[p] &= ~(1 << digit);
  const next = { ...g, values, notes };
  if (values.every((v, i) => v === g.solution[i])) return [{ ...next, status: 'won', selected: null }, { kind: 'won' }];
  const group = rules.group(cell);
  return [next, { kind: 'correct', cell, groupDone: group.every((c) => values[c] === g.solution[c]) ? group : null }];
}

/** Apply an action. Returns the same object when nothing changed. */
export function reduceGrid<G extends NumberGrid>(g: G, action: GridAction, rules: GridRules): [G, GridEvent] {
  const none: GridEvent = { kind: 'none' };
  if (g.status !== 'playing') return [g, none];
  const n = Math.round(Math.sqrt(g.values.length));
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
      if (i == null || d < 1 || d > g.size || !isEditable(g, i)) return [g, none];
      if (g.notesMode) {
        if (g.values[i]) return [g, none]; // can't annotate a (wrong) filled cell
        const notes = g.notes.slice();
        notes[i] ^= 1 << d;
        return [{ ...g, notes, undo: snapshot(g), touched: true }, none];
      }
      if (g.values[i] === d) return [g, none];
      const base = { ...g, undo: snapshot(g), touched: true };
      if (d === g.solution[i]) return placeCorrect(base, i, rules);
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
        const open = g.values.map((_, k) => k).filter((k) => isEditable(g, k));
        const ordered = rules.hintOrder ? rules.hintOrder(open) : open;
        if (!ordered.length) return [g, none];
        i = ordered[0];
      }
      return placeCorrect({ ...g, undo: snapshot(g), hints: g.hints + 1, selected: i, touched: true }, i, rules);
    }
  }
}

/**
 * Start the puzzle over: every digit and note is cleared and the undo history goes. Mistakes,
 * hints and time are kept (so restarting can't improve a result). Returns the same object when
 * there's nothing to clear.
 */
export function restartGrid<G extends NumberGrid>(g: G): G {
  if (g.status !== 'playing' || (g.values.every((v) => v === 0) && g.notes.every((n) => n === 0))) return g;
  return { ...g, values: g.values.map(() => 0), notes: g.notes.map(() => 0), undo: [] };
}
