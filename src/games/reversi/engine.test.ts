import { describe, expect, it } from 'vitest';
import { chooseMove, count, flips, legalMoves, play, startBoard } from './engine';

describe('reversi', () => {
  it('starts with four discs and four moves each', () => {
    const b = startBoard();
    expect(count(b, 1)).toBe(2);
    expect(legalMoves(b, 1).sort((a, c) => a - c)).toEqual([19, 26, 37, 44]);
    expect(legalMoves(b, 2)).toHaveLength(4);
  });

  it('turns over the discs in between, in every direction', () => {
    const b = startBoard();
    expect(flips(b, 19, 1)).toEqual([27]);
    const after = play(b, 19, 1);
    expect(count(after, 1)).toBe(4);
    expect(count(after, 2)).toBe(1);
    expect(flips(b, 0, 1)).toEqual([]);
  });

  it('does not wrap around the board edge', () => {
    const b = new Array(64).fill(0);
    // Row 0 ends with an opponent disc; row 1 starts with ours: no line between them.
    b[7] = 2;
    b[8] = 1;
    expect(flips(b, 6, 1)).toEqual([]);
  });

  it('the computer takes a corner when it can', () => {
    const b = new Array(64).fill(0);
    b[9] = 1;
    b[18] = 2;
    expect(chooseMove(b, 2, 3)).toBe(0);
  });
});
