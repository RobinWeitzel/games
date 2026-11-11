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
});
