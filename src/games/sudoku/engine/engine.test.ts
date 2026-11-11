import { describe, expect, it } from 'vitest';
import { createRng } from '../../../core/random';
import { BOXES, COLS, ROWS, fromString } from './board';
import { DIFFICULTIES, generate } from './generator';
import { grade } from './grader';
import { countSolutions, randomFullGrid, solve } from './solver';

const isValidSolution = (g: number[]) =>
  [...ROWS, ...COLS, ...BOXES].every((u) => new Set(u.map((i) => g[i])).size === 9 && u.every((i) => g[i] > 0));

describe('solver', () => {
  it('solves a known puzzle', () => {
    const p = fromString('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');
    const s = solve(p)!;
    expect(isValidSolution(s)).toBe(true);
    expect(s.slice(0, 9)).toEqual([5, 3, 4, 6, 7, 8, 9, 1, 2]);
  });

  it('detects multiple solutions and invalid grids', () => {
    expect(countSolutions(new Array(81).fill(0), 2)).toBe(2);
    const bad = new Array(81).fill(0);
    bad[0] = 1;
    bad[1] = 1;
    expect(countSolutions(bad, 2)).toBe(0);
  });

  it('creates valid random full grids', () => {
    const rng = createRng(1);
    for (let n = 0; n < 5; n++) expect(isValidSolution(randomFullGrid(rng))).toBe(true);
  });
});

describe('grader', () => {
  it('rates a singles-only puzzle as level 1', () => {
    const p = fromString('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');
    expect(grade(p).level).toBe(1);
  });

  it('never makes an invalid deduction', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generate('expert', createRng(seed));
      expect(() => grade(p.puzzle, 3, p.solution)).not.toThrow();
    }
  });
});

describe('generator', () => {
  for (const d of DIFFICULTIES) {
    it(`generates unique, correctly graded ${d} puzzles`, () => {
      for (let seed = 0; seed < 5; seed++) {
        const p = generate(d, createRng(seed + 100));
        expect(countSolutions(p.puzzle, 2)).toBe(1);
        expect(isValidSolution(p.solution)).toBe(true);
        p.puzzle.forEach((v, i) => v && expect(v).toBe(p.solution[i]));
        expect(p.level).toBe({ easy: 1, medium: 1, hard: 2, expert: 3 }[d]);
      }
    });
  }

  it('is deterministic for the same seed (daily puzzle)', () => {
    expect(generate('hard', createRng(7)).puzzle).toEqual(generate('hard', createRng(7)).puzzle);
  });
});
