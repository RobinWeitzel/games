import { BOXES, COLS, PEERS, ROWS, bit, boxOf, candidatesFor, colOf, rowOf } from './engine/board';
import type { Difficulty } from './engine/generator';

export const MAX_MISTAKES = 3;
const MAX_UNDO = 150;

export type Mode = Difficulty | 'daily';

export interface Snapshot {
  values: number[];
  notes: number[];
}

export interface SudokuGame {
  id: string;
  mode: Mode;
  difficulty: Difficulty;
  /** Set for daily puzzles (YYYY-MM-DD). */
  date?: string;
  puzzle: number[];
  solution: number[];
  values: number[];
  /** Candidate bitmask per cell (bits 1..9). */
  notes: number[];
  mistakes: number;
  hints: number;
  elapsedMs: number;
  status: 'playing' | 'won' | 'lost';
  selected: number | null;
  notesMode: boolean;
  undo: Snapshot[];
  /** True once the player made any move (abandoning an untouched game isn't a loss). */
  touched: boolean;
  /**
   * Number lock: while set, tapping a cell enters this digit (or toggles it as a note in notes
   * mode). Optional, added after release: saves without it simply have no lock.
   */
  lockedDigit?: number | null;
}

export interface Options {
  mistakeLimit: boolean;
  autoRemoveNotes: boolean;
  /** Fill a cell when its notes are reduced to a single one (cascades). Optional for older callers. */
  autoFillSingles?: boolean;
}

export type Action =
  | { type: 'select'; cell: number }
  | { type: 'move'; dr: number; dc: number }
  | { type: 'input'; digit: number }
  /** Lock a digit for repeated entry; locking the locked digit again ends the lock. */
  | { type: 'lockDigit'; digit: number }
  | { type: 'erase' }
  | { type: 'toggleNotes' }
  | { type: 'undo' }
  | { type: 'hint' }
  | { type: 'fillNotes' }
  | { type: 'restart' };

/** Side effects for the UI (haptics, animations). */
export type GameEvent =
  | {
      kind: 'correct';
      cell: number;
      completedUnits: number[][];
      /** Cells filled automatically because they were left with a single note. */
      autoFilled?: number[];
    }
  | { kind: 'mistake'; cell: number }
  | { kind: 'won' }
  | { kind: 'lost' }
  | { kind: 'none' };

export function newGame(p: {
  puzzle: number[];
  solution: number[];
  mode: Mode;
  difficulty: Difficulty;
  date?: string;
}): SudokuGame {
  return {
    id: Math.random().toString(36).slice(2),
    mode: p.mode,
    difficulty: p.difficulty,
    date: p.date,
    puzzle: p.puzzle.slice(),
    solution: p.solution.slice(),
    values: p.puzzle.slice(),
    notes: new Array(81).fill(0),
    mistakes: 0,
    hints: 0,
    elapsedMs: 0,
    status: 'playing',
    selected: null,
    notesMode: false,
    undo: [],
    touched: false,
  };
}

const isGiven = (g: SudokuGame, i: number) => g.puzzle[i] !== 0;
const isCorrect = (g: SudokuGame, i: number) => g.values[i] !== 0 && g.values[i] === g.solution[i];
/** Cells the player may still change: empty or wrong. */
const isEditable = (g: SudokuGame, i: number) => !isGiven(g, i) && !isCorrect(g, i);

function snapshot(g: SudokuGame): Snapshot[] {
  return [...g.undo, { values: g.values, notes: g.notes }].slice(-MAX_UNDO);
}

function removeFromPeerNotes(notes: number[], cell: number, digit: number): number[] {
  const out = notes.slice();
  for (const p of PEERS[cell]) out[p] &= ~bit(digit);
  return out;
}

function completedUnitsAt(values: number[], solution: number[], cell: number): number[][] {
  return [ROWS[rowOf(cell)], COLS[colOf(cell)], BOXES[boxOf(cell)]].filter((u) =>
    u.every((i) => values[i] === solution[i]),
  );
}

const isSolved = (g: SudokuGame) => g.values.every((v, i) => v === g.solution[i]);

/** Place the correct digit (used by input and hint). */
function placeCorrect(g: SudokuGame, cell: number, opts: Options): [SudokuGame, GameEvent] {
  const digit = g.solution[cell];
  const values = g.values.slice();
  values[cell] = digit;
  let notes = g.notes.slice();
  notes[cell] = 0;
  if (opts.autoRemoveNotes) notes = removeFromPeerNotes(notes, cell, digit);
  const next = { ...g, values, notes };
  if (isSolved(next)) return [{ ...next, status: 'won', selected: null }, { kind: 'won' }];
  return [next, { kind: 'correct', cell, completedUnits: completedUnitsAt(values, g.solution, cell) }];
}

export function reduce(g: SudokuGame, action: Action, opts: Options): [SudokuGame, GameEvent] {
  const [next, ev] = reduceAction(g, action, opts);
  // Moves that can take notes away (placing a digit, removing a note) may leave cells with one note.
  if (opts.autoFillSingles && next !== g && (action.type === 'input' || action.type === 'select' || action.type === 'hint')) {
    return fillSingles(g, next, ev, opts);
  }
  return [next, ev];
}

const bitCount = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};

/**
 * "Fill single notes": every empty cell whose notes were *reduced* to exactly one (by a placed
 * digit clearing peer notes, or by the player removing a note) gets that digit. Each fill clears
 * more notes, so this repeats until nothing changes. Adding a first note never triggers it.
 *
 * A wrong single note is entered like the player would have: it counts as a mistake and stops
 * the cascade (silently skipping it would reveal that the note is wrong).
 * The whole cascade is part of the player's move, so one Undo reverts it all.
 */
function fillSingles(prev: SudokuGame, g: SudokuGame, ev: GameEvent, opts: Options): [SudokuGame, GameEvent] {
  if (g.status !== 'playing' || (ev.kind !== 'correct' && ev.kind !== 'none')) return [g, ev];
  let cur = g;
  let before = prev.notes;
  const filled: number[] = [];
  const units = ev.kind === 'correct' ? [...ev.completedUnits] : [];
  let result: GameEvent | null = null;

  outer: for (;;) {
    const targets = cur.notes
      .map((n, i) => (cur.values[i] === 0 && bitCount(n) === 1 && bitCount(before[i]) > 1 ? i : -1))
      .filter((i) => i >= 0);
    if (!targets.length) break;
    before = cur.notes;
    for (const i of targets) {
      if (cur.values[i] !== 0 || bitCount(cur.notes[i]) !== 1) continue; // changed by an earlier fill
      const d = Math.log2(cur.notes[i]);
      filled.push(i);
      if (d === cur.solution[i]) {
        const [next, e] = placeCorrect(cur, i, opts);
        cur = next;
        if (e.kind === 'won') {
          result = e;
          break outer;
        }
        if (e.kind === 'correct') units.push(...e.completedUnits);
      } else {
        const values = cur.values.slice();
        values[i] = d;
        const notes = cur.notes.slice();
        notes[i] = 0;
        const mistakes = cur.mistakes + 1;
        const lost = opts.mistakeLimit && mistakes >= MAX_MISTAKES;
        cur = { ...cur, values, notes, mistakes, status: lost ? 'lost' : 'playing' };
        result = lost ? { kind: 'lost' } : { kind: 'mistake', cell: i };
        break outer;
      }
    }
  }

  if (!filled.length) return [g, ev];
  if (cur.lockedDigit && digitCounts(cur)[cur.lockedDigit] === 9) cur = { ...cur, lockedDigit: null };
  return [
    { ...cur, touched: true },
    result ?? { kind: 'correct', cell: ev.kind === 'correct' ? ev.cell : filled[0], completedUnits: units, autoFilled: filled },
  ];
}

function reduceAction(g: SudokuGame, action: Action, opts: Options): [SudokuGame, GameEvent] {
  const none: GameEvent = { kind: 'none' };
  if (action.type === 'restart') {
    return [{ ...newGame({ ...g }), id: g.id }, none];
  }
  if (g.status !== 'playing') return [g, none];

  switch (action.type) {
    case 'select': {
      const selected = { ...g, selected: action.cell };
      if (!g.lockedDigit) return [selected, none];
      // Number lock: tapping a cell enters the locked digit there.
      const [next, ev] = enterDigit(selected, action.cell, g.lockedDigit, opts);
      return [next, ev];
    }

    case 'lockDigit':
      return [{ ...g, lockedDigit: g.lockedDigit === action.digit ? null : action.digit }, none];

    case 'move': {
      const cur = g.selected ?? 40;
      const r = (rowOf(cur) + action.dr + 9) % 9;
      const c = (colOf(cur) + action.dc + 9) % 9;
      return [{ ...g, selected: r * 9 + c }, none];
    }

    case 'toggleNotes':
      return [{ ...g, notesMode: !g.notesMode }, none];

    case 'input': {
      // While a digit is locked, the keypad switches the lock instead of entering numbers.
      if (g.lockedDigit) return reduceAction(g, { type: 'lockDigit', digit: action.digit }, opts);
      if (g.selected == null) return [g, none];
      return enterDigit(g, g.selected, action.digit, opts);
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
        // Pick the empty/wrong cell with the fewest candidates: the most useful hint.
        let best = -1;
        let bestCount = 99;
        for (let k = 0; k < 81; k++) {
          if (!isEditable(g, k)) continue;
          const n = countBits(candidatesFor(correctValues(g), k));
          if (n < bestCount) {
            best = k;
            bestCount = n;
          }
        }
        if (best < 0) return [g, none];
        i = best;
      }
      const base = { ...g, undo: snapshot(g), hints: g.hints + 1, selected: i, touched: true };
      return placeCorrect(base, i, opts);
    }

    case 'fillNotes': {
      const vals = correctValues(g);
      const notes = g.notes.map((n, i) => (g.values[i] ? n : candidatesFor(vals, i)));
      return [{ ...g, notes, undo: snapshot(g), touched: true }, none];
    }
  }
}

/**
 * Enter `d` into cell `i`: toggles a note in notes mode, otherwise places the digit (counting a
 * mistake if it's wrong). Returns `g` unchanged if the cell can't take it. Ends the number lock
 * once all nine of the locked digit are placed.
 */
function enterDigit(g: SudokuGame, i: number, d: number, opts: Options): [SudokuGame, GameEvent] {
  const none: GameEvent = { kind: 'none' };
  if (!isEditable(g, i)) return [g, none];

  if (g.notesMode) {
    if (g.values[i]) return [g, none]; // can't annotate a (wrong) filled cell
    const notes = g.notes.slice();
    notes[i] ^= bit(d);
    return [{ ...g, notes, undo: snapshot(g), touched: true }, none];
  }

  if (g.values[i] === d) return [g, none];
  const base = { ...g, undo: snapshot(g), touched: true };
  if (d === g.solution[i]) {
    const [next, ev] = placeCorrect(base, i, opts);
    const done = next.lockedDigit && digitCounts(next)[next.lockedDigit] === 9;
    return [done ? { ...next, lockedDigit: null } : next, ev];
  }

  const values = g.values.slice();
  values[i] = d;
  const notes = g.notes.slice();
  notes[i] = 0;
  const mistakes = g.mistakes + 1;
  const lost = opts.mistakeLimit && mistakes >= MAX_MISTAKES;
  return [
    { ...base, values, notes, mistakes, status: lost ? 'lost' : 'playing' },
    lost ? { kind: 'lost' } : { kind: 'mistake', cell: i },
  ];
}

/** Values with wrong entries removed, so candidates aren't computed from mistakes. */
function correctValues(g: SudokuGame): number[] {
  return g.values.map((v, i) => (v === g.solution[i] ? v : 0));
}

function countBits(m: number): number {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
}

/** How many of each digit are correctly placed (index 1..9). */
export function digitCounts(g: SudokuGame): number[] {
  const counts = new Array(10).fill(0);
  g.values.forEach((v, i) => {
    if (v && v === g.solution[i]) counts[v]++;
  });
  return counts;
}

export function progress(g: SudokuGame): number {
  const open = g.puzzle.filter((v) => !v).length;
  const filled = g.values.filter((v, i) => !g.puzzle[i] && v === g.solution[i]).length;
  return open ? filled / open : 1;
}
