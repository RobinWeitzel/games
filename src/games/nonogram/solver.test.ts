import { describe, expect, it } from 'vitest';
import { EMPTY, FILLED, UNKNOWN, cluesOf, isLineSolvable, runs, solveByLines, solveLine } from './solver';

const U = UNKNOWN;

describe('nonogram line solver', () => {
  it('reads run lengths', () => {
    expect(runs([1, 1, 0, 1, 1, 1])).toEqual([2, 3]);
    expect(runs([0, 0, 0])).toEqual([]);
    expect(runs([1, 0, 1, 0, 1])).toEqual([1, 1, 1]);
  });

  it('finds the overlap of a long block', () => {
    // 4 in 5: the middle three are filled whatever the placement.
    expect(solveLine([4], [U, U, U, U, U])).toEqual([U, FILLED, FILLED, FILLED, U]);
  });

  it('fills a line that has only one arrangement', () => {
    expect(solveLine([2, 2], [U, U, U, U, U])).toEqual([FILLED, FILLED, EMPTY, FILLED, FILLED]);
    expect(solveLine([], [U, U, U])).toEqual([EMPTY, EMPTY, EMPTY]);
  });

  it('uses what is already known', () => {
    // A 1 in 5 with the third cell filled: everything else is empty.
    expect(solveLine([1], [U, U, FILLED, U, U])).toEqual([EMPTY, EMPTY, FILLED, EMPTY, EMPTY]);
    // 3 in 6 next to a known gap at index 2: it must be in the last three.
    expect(solveLine([3], [U, U, EMPTY, U, U, U])).toEqual([EMPTY, EMPTY, EMPTY, FILLED, FILLED, FILLED]);
  });

  it('reports contradictions', () => {
    expect(solveLine([3], [U, EMPTY, U, EMPTY, U])).toBeNull();
    expect(solveLine([1], [FILLED, FILLED, U])).toBeNull();
  });

  it('solves a whole puzzle line by line', () => {
    // A plus sign.
    const plus = [0, 1, 0, 1, 1, 1, 0, 1, 0];
    expect(solveByLines(cluesOf(plus, 3, 3))).toEqual(plus);
  });

  it('rejects puzzles that need a guess (two solutions)', () => {
    // A diagonal: the anti-diagonal has the same clues.
    expect(isLineSolvable(cluesOf([1, 0, 0, 1], 2, 2))).toBe(false);
  });
});
