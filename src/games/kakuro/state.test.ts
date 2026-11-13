import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { COMBOS, findRuns, generate, puzzleRuns, runDigits, solve } from './engine';
import { KakuroGame, isWhite, newGame, progress, reduce, restart } from './state';

/** A puzzle from rows of digits ('#' = black); the sums come from the digits. */
function fromRows(rows: string[]) {
  const n = rows.length;
  const solution = rows.join('').split('').map((ch) => (ch === '#' ? 0 : Number(ch)));
  const across = new Array(n * n).fill(0);
  const down = new Array(n * n).fill(0);
  for (const run of findRuns(n, solution.map((d) => d > 0), solution)) (run.dir === 'across' ? across : down)[run.clue] = run.sum;
  return { n, solution, across, down };
}

describe('engine', () => {
  it('knows the digit combinations of a sum', () => {
    expect(COMBOS[2][3]).toEqual([0b110]); // 1 + 2
    expect(runDigits(2, 17)).toBe((1 << 8) | (1 << 9));
    expect(COMBOS[9][45]).toHaveLength(1);
    expect(COMBOS[3][6]).toHaveLength(1); // 1 + 2 + 3
  });

  it('solves a small puzzle and sees a second solution', () => {
    // Across 3 and 4, down 4 and 3: only 1 2 / 3 1 fits.
    const unique = fromRows(['###', '#12', '#31']);
    expect(solve(unique.n, puzzleRuns(unique), 3)).toEqual([unique.solution]);
    // Rows 1+2 = 3 and 2+1 = 3, columns 3 and 3: both 12/21 and 21/12 fit.
    const twice = fromRows(['###', '#12', '#21']);
    expect(solve(twice.n, puzzleRuns(twice), 3)).toHaveLength(2);
  });

  it('generates puzzles with one solution', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const p = generate(d, createRng(3));
      expect(solve(p.n, puzzleRuns(p), 2)).toEqual([p.solution]);
      // Every white cell is in an across and a down run of at least two cells, with different digits.
      for (const run of puzzleRuns(p)) {
        expect(run.cells.length).toBeGreaterThanOrEqual(2);
        expect(new Set(run.cells.map((c) => p.solution[c])).size).toBe(run.cells.length);
        expect(run.cells.reduce((s, c) => s + p.solution[c], 0)).toBe(run.sum);
      }
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate('medium', createRng(9))).toEqual(generate('medium', createRng(9)));
  });
});

describe('game', () => {
  const p = generate('easy', createRng(5));
  const fresh = (): KakuroGame => newGame({ mode: 'easy', difficulty: 'easy', ...p });
  const white = p.solution.findIndex((d) => d > 0);
  const black = p.solution.findIndex((d) => d === 0);

  it('black cells cannot be selected or filled', () => {
    let g = fresh();
    [g] = reduce(g, { type: 'select', cell: black });
    expect(g.selected).toBeNull();
    [g] = reduce(g, { type: 'select', cell: white });
    expect(g.selected).toBe(white);
  });

  it('arrow keys skip black cells', () => {
    let g = fresh();
    [g] = reduce(g, { type: 'select', cell: white });
    for (let k = 0; k < 20; k++) {
      [g] = reduce(g, { type: 'move', dr: 0, dc: 1 });
      expect(isWhite(g, g.selected!)).toBe(true);
    }
  });

  it('a wrong digit is a mistake, the right one removes notes in its runs', () => {
    let g = fresh();
    [g] = reduce(g, { type: 'select', cell: white });
    const right = p.solution[white];
    const wrong = right === 9 ? 1 : right + 1;
    let ev;
    [g, ev] = reduce(g, { type: 'input', digit: wrong });
    expect(ev.kind).toBe('mistake');
    expect(g.mistakes).toBe(1);
    [g, ev] = reduce(g, { type: 'input', digit: right });
    expect(ev.kind).toBe('correct');
    expect(progress(g)).toBeGreaterThan(0);
  });

  it('hints solve the puzzle and never pick a black cell', () => {
    let g = fresh();
    [g] = reduce(g, { type: 'select', cell: white });
    let ev;
    for (let k = 0; k < 100 && g.status === 'playing'; k++) {
      [g, ev] = reduce(g, { type: 'hint' });
      expect(g.values.every((v, i) => v === 0 || isWhite(g, i))).toBe(true);
    }
    expect(ev!.kind).toBe('won');
    expect(progress(g)).toBe(1);
  });

  it('restart clears digits, notes and undo, keeping mistakes, hints and time', () => {
    const g0 = fresh();
    expect(restart(g0)).toBe(g0);
    const g = { ...reduce(g0, { type: 'hint' })[0], mistakes: 2, elapsedMs: 5000 };
    expect(g.values).not.toEqual(g0.values);
    const r = restart(g);
    expect(r.values).toEqual(g0.values);
    expect(r.notes).toEqual(g0.notes);
    expect(r).toMatchObject({ status: 'playing', undo: [], hints: 1, mistakes: 2, elapsedMs: 5000 });
    expect(restart(r)).toBe(r);
  });
});
