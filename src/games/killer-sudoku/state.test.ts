import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { PEERS, boxOf, generate, randomGrid, solve } from './engine';
import { newGame, reduce } from './state';

describe('engine', () => {
  it('builds valid Sudoku grids', () => {
    const g = randomGrid(createRng(1));
    for (let i = 0; i < 81; i++) for (const p of PEERS[i]) expect(g[p]).not.toBe(g[i]);
    expect(boxOf(80)).toBe(8);
  });

  it('generates puzzles with one solution, cage sums right and no repeats in a cage', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const p = generate(d, createRng(d.length));
      expect(solve(p.cages, 2)).toHaveLength(1);
      expect(p.cages.flatMap((c) => c.cells).sort((a, b) => a - b)).toEqual(Array.from({ length: 81 }, (_, i) => i));
      for (const c of p.cages) {
        const digits = c.cells.map((i) => p.solution[i]);
        expect(new Set(digits).size).toBe(digits.length);
        expect(digits.reduce((a, b) => a + b, 0)).toBe(c.sum);
      }
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate('medium', createRng(4))).toEqual(generate('medium', createRng(4)));
  });
});

describe('game', () => {
  const p = generate('easy', createRng(2));
  const fresh = () => newGame({ mode: 'easy', difficulty: 'easy', ...p });

  it('counts mistakes and locks correct digits', () => {
    let g = reduce(fresh(), { type: 'select', cell: 0 })[0];
    [g] = reduce(g, { type: 'input', digit: (p.solution[0] % 9) + 1 });
    expect(g.mistakes).toBe(1);
    const [done, ev] = reduce(g, { type: 'input', digit: p.solution[0] });
    expect(ev.kind).toBe('correct');
    expect(reduce(done, { type: 'erase' })[0]).toBe(done);
  });

  it('a placed digit clears that note in its row, column, box and cage', () => {
    let g = reduce(fresh(), { type: 'toggleNotes' })[0];
    const d = p.solution[0];
    g = reduce(reduce(g, { type: 'select', cell: 10 })[0], { type: 'input', digit: d })[0]; // same box
    expect(g.notes[10]).toBe(1 << d);
    g = reduce(reduce(reduce(g, { type: 'toggleNotes' })[0], { type: 'select', cell: 0 })[0], { type: 'input', digit: d })[0];
    expect(g.notes[10]).toBe(0);
  });

  it('hints solve the puzzle', () => {
    let g = fresh();
    let ev;
    for (let k = 0; k < 81; k++) [g, ev] = reduce(g, { type: 'hint' });
    expect(ev!.kind).toBe('won');
  });
});
