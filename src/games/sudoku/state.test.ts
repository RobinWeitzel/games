import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { generate } from './engine/generator';
import { bit } from './engine/board';
import { Action, SudokuGame, newGame, reduce } from './state';

const opts = { mistakeLimit: true, autoRemoveNotes: true };
const p = generate('easy', createRng(3));
const fresh = () => newGame({ puzzle: p.puzzle, solution: p.solution, mode: 'easy', difficulty: 'easy' });
const empty = (g: SudokuGame) => g.puzzle.findIndex((v) => v === 0);
const run = (g: SudokuGame, ...actions: Action[]) => actions.reduce((acc, a) => reduce(acc, a, opts)[0], g);
const wrongDigit = (g: SudokuGame, i: number) => (g.solution[i] % 9) + 1;

describe('sudoku state', () => {
  it('places correct digits and removes peer notes', () => {
    let g = fresh();
    const i = empty(g);
    const peer = g.puzzle.findIndex((v, k) => k !== i && v === 0 && Math.floor(k / 9) === Math.floor(i / 9));
    g = run(g, { type: 'select', cell: peer }, { type: 'toggleNotes' }, { type: 'input', digit: g.solution[i] }, { type: 'toggleNotes' });
    expect(g.notes[peer] & bit(g.solution[i])).toBeTruthy();
    const [next, ev] = reduce(run(g, { type: 'select', cell: i }), { type: 'input', digit: g.solution[i] }, opts);
    expect(ev.kind).toBe('correct');
    expect(next.values[i]).toBe(g.solution[i]);
    expect(next.notes[peer] & bit(g.solution[i])).toBe(0);
  });

  it('counts mistakes and ends the game at three', () => {
    let g = run(fresh(), { type: 'select', cell: empty(fresh()) });
    const i = g.selected!;
    for (let n = 0; n < 2; n++) g = run(g, { type: 'erase' }, { type: 'input', digit: wrongDigit(g, i) });
    expect(g.mistakes).toBe(2);
    const [, ev] = reduce(run(g, { type: 'erase' }), { type: 'input', digit: wrongDigit(g, i) }, opts);
    expect(ev.kind).toBe('lost');
  });

  it('does not end the game when the mistake limit is off', () => {
    let g = run(fresh(), { type: 'select', cell: empty(fresh()) });
    for (let n = 0; n < 5; n++) [g] = reduce(run(g, { type: 'erase' }), { type: 'input', digit: wrongDigit(g, g.selected!) }, { ...opts, mistakeLimit: false });
    expect(g.status).toBe('playing');
    expect(g.mistakes).toBe(5);
  });

  it('undo restores values and notes', () => {
    const g0 = run(fresh(), { type: 'select', cell: empty(fresh()) });
    const g1 = run(g0, { type: 'input', digit: g0.solution[g0.selected!] }, { type: 'undo' });
    expect(g1.values).toEqual(g0.values);
  });

  it('wins when hints fill the board, and counts hints', () => {
    let g = fresh();
    const open = g.puzzle.filter((v) => !v).length;
    let last;
    for (let n = 0; n < open; n++) [g, last] = reduce(g, { type: 'hint' }, opts);
    expect(last!.kind).toBe('won');
    expect(g.status).toBe('won');
    expect(g.hints).toBe(open);
  });

  it('fills notes with valid candidates that include the solution', () => {
    const g = run(fresh(), { type: 'fillNotes' });
    g.puzzle.forEach((v, i) => {
      if (!v) expect(g.notes[i] & bit(g.solution[i])).toBeTruthy();
    });
  });

  describe('number lock', () => {
    const emptyCells = (g: SudokuGame) => g.puzzle.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);

    it('enters the locked digit into every tapped cell', () => {
      let g = fresh();
      const d = g.solution[empty(g)];
      const targets = emptyCells(g).filter((i) => g.solution[i] === d).slice(0, 2);
      g = run(g, { type: 'lockDigit', digit: d }, ...targets.map((cell) => ({ type: 'select' as const, cell })));
      for (const i of targets) expect(g.values[i]).toBe(d);
      expect(g.lockedDigit).toBe(d);
    });

    it('toggles notes instead when notes mode is on', () => {
      const g0 = fresh();
      const i = empty(g0);
      let g = run(g0, { type: 'toggleNotes' }, { type: 'lockDigit', digit: 5 }, { type: 'select', cell: i });
      expect(g.notes[i] & bit(5)).toBeTruthy();
      expect(g.values[i]).toBe(0);
      g = run(g, { type: 'select', cell: i });
      expect(g.notes[i] & bit(5)).toBe(0);
    });

    it('keypad switches the lock; the locked key ends it', () => {
      let g = run(fresh(), { type: 'lockDigit', digit: 3 });
      g = run(g, { type: 'input', digit: 7 });
      expect(g.lockedDigit).toBe(7);
      g = run(g, { type: 'input', digit: 7 });
      expect(g.lockedDigit).toBeNull();
    });

    it('only selects given cells', () => {
      const g0 = fresh();
      const given = g0.puzzle.findIndex((v) => v !== 0);
      const g = run(g0, { type: 'lockDigit', digit: 1 }, { type: 'select', cell: given });
      expect(g.selected).toBe(given);
      expect(g.values).toEqual(g0.values);
    });

    it('counts wrong entries as mistakes', () => {
      const g0 = fresh();
      const i = empty(g0);
      const [g, ev] = reduce(run(g0, { type: 'lockDigit', digit: wrongDigit(g0, i) }), { type: 'select', cell: i }, opts);
      expect(ev.kind).toBe('mistake');
      expect(g.mistakes).toBe(1);
    });

    it('ends when all nine of the digit are placed', () => {
      let g = fresh();
      const d = g.solution[empty(g)];
      g = run(g, { type: 'lockDigit', digit: d });
      for (const i of emptyCells(g).filter((k) => g.solution[k] === d)) g = run(g, { type: 'select', cell: i });
      expect(g.lockedDigit).toBeNull();
    });

    it('loads saves made before the feature (no lockedDigit field)', () => {
      const { lockedDigit: _unused, ...old } = fresh();
      const g = run(old as SudokuGame, { type: 'select', cell: empty(old as SudokuGame) });
      expect(g.values).toEqual(old.values);
    });
  });

  describe('autofill (per game)', () => {
    // Solved board except four cells in row 1: p, a, b, c (cells 0..3).
    // Notes: a = {A, P}, b = {B, A}, c = {C, B}. Placing P in p should fill a, then b, then c.
    const setup = (extraEmpty = false, autoFill = true) => {
      const g = fresh();
      const sol = g.solution;
      const values = sol.slice();
      for (const i of [0, 1, 2, 3]) values[i] = 0;
      if (extraEmpty) values[80] = 0; // keeps the game from being won by the cascade
      const notes = new Array(81).fill(0);
      const [P, A, B, C] = [sol[0], sol[1], sol[2], sol[3]];
      notes[1] = bit(A) | bit(P);
      notes[2] = bit(B) | bit(A);
      notes[3] = bit(C) | bit(B);
      return { g: { ...g, puzzle: values.slice(), values, notes, selected: 0, autoFill }, P, A, B, C };
    };

    it('is off at the start of every game and after a restart', () => {
      expect(fresh().autoFill).toBeFalsy();
      const { g } = setup(true);
      const [restarted] = reduce(g, { type: 'restart' }, opts);
      expect(restarted.autoFill).toBeFalsy();
    });

    it('cascades: each fill can leave the next cell with one note', () => {
      const { g, P } = setup(true);
      const [next, ev] = reduce(g, { type: 'input', digit: P }, opts);
      expect(next.values.slice(0, 4)).toEqual(g.solution.slice(0, 4));
      expect(ev).toMatchObject({ kind: 'correct', autoFilled: [1, 2, 3] });
    });

    it('does nothing while off', () => {
      const { g, P, A } = setup(true, false);
      const [next] = reduce(g, { type: 'input', digit: P }, opts);
      expect(next.values[1]).toBe(0);
      expect(next.notes[1]).toBe(bit(A));
    });

    it('switching on fills cells that already have one note, as one undoable move', () => {
      const { g, P } = setup(true, false);
      const placed = reduce(g, { type: 'input', digit: P }, opts)[0]; // a is now {A}, autofill off
      expect(placed.values[1]).toBe(0);
      const [on, ev] = reduce(placed, { type: 'toggleAutoFill' }, opts);
      expect(on.autoFill).toBe(true);
      expect(on.values.slice(0, 4)).toEqual(g.solution.slice(0, 4));
      expect(ev).toMatchObject({ kind: 'correct', autoFilled: [1, 2, 3] });
      const [undone] = reduce(on, { type: 'undo' }, opts);
      expect(undone.values).toEqual(placed.values);
    });

    it('switching on with nothing to fill is not a move', () => {
      const { g } = setup(true, false);
      const [on, ev] = reduce(g, { type: 'toggleAutoFill' }, opts);
      expect(ev.kind).toBe('none');
      expect(on.autoFill).toBe(true);
      expect(on.undo.length).toBe(g.undo.length);
      expect(reduce(on, { type: 'toggleAutoFill' }, opts)[0].autoFill).toBe(false);
    });

    it('can win the game', () => {
      const { g, P } = setup();
      const [next, ev] = reduce(g, { type: 'input', digit: P }, opts);
      expect(ev.kind).toBe('won');
      expect(next.status).toBe('won');
    });

    it('never fills a cell when its first note is added', () => {
      const { g } = setup(true);
      const empty = { ...g, notes: new Array(81).fill(0), selected: 80, notesMode: true };
      const [next] = reduce(empty, { type: 'input', digit: g.solution[80] }, opts);
      expect(next.values[80]).toBe(0);
      expect(next.notes[80]).toBe(bit(g.solution[80]));
    });

    it('fills when the player removes a note and one is left', () => {
      const { g, P } = setup(true);
      const [next, ev] = reduce({ ...g, selected: 1, notesMode: true }, { type: 'input', digit: P }, opts);
      expect(next.values[1]).toBe(g.solution[1]);
      expect(ev).toMatchObject({ kind: 'correct', autoFilled: [1, 2, 3] });
    });

    it('enters a wrong single note as a mistake and stops the cascade', () => {
      const { g, P, A, B } = setup(true);
      const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => d !== A && d !== P && d !== B)!;
      const notes = g.notes.slice();
      notes[1] = bit(wrong) | bit(P); // the player's notes are wrong in cell a
      const [next, ev] = reduce({ ...g, notes }, { type: 'input', digit: P }, opts);
      expect(ev).toEqual({ kind: 'mistake', cell: 1 });
      expect(next.values[1]).toBe(wrong);
      expect(next.mistakes).toBe(1);
      expect(next.values[2]).toBe(0); // cascade stopped
    });

    it('is undone together with the move that triggered it', () => {
      const { g, P } = setup(true);
      const [next] = reduce(g, { type: 'input', digit: P }, opts);
      const [undone] = reduce(next, { type: 'undo' }, opts);
      expect(undone.values).toEqual(g.values);
      expect(undone.notes).toEqual(g.notes);
    });
  });
});
