import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { COLS, ROWS, WINDOWS, chooseMove, dropRow, winLine } from './engine';

const empty = () => new Array(ROWS * COLS).fill(0);
const at = (r: number, c: number) => r * COLS + c;

describe('four in a row', () => {
  it('has 69 lines of four', () => {
    expect(WINDOWS).toHaveLength(69);
  });

  it('drops discs to the lowest free row', () => {
    const b = empty();
    expect(dropRow(b, 3)).toBe(5);
    b[at(5, 3)] = 1;
    expect(dropRow(b, 3)).toBe(4);
  });

  it('finds lines in every direction', () => {
    const b = empty();
    [0, 1, 2, 3].forEach((k) => (b[at(5 - k, k)] = 2));
    expect(winLine(b, 2)?.slice().sort((x, y) => x - y)).toEqual([at(2, 3), at(3, 2), at(4, 1), at(5, 0)]);
    expect(winLine(b, 1)).toBeNull();
  });

  it('takes a win and blocks a loss', () => {
    const b = empty();
    [0, 1, 2].forEach((c) => (b[at(5, c)] = 2));
    expect(chooseMove(b, 2, 1)).toBe(3);
    const c = empty();
    [0, 1, 2].forEach((col) => (c[at(5, col)] = 1));
    expect(chooseMove(c, 2, 1)).toBe(3);
  });

  it('looks ahead: avoids a move that lets the opponent win on top of it', () => {
    // You have three in a row on the second row from the bottom, waiting for column 3; column 3
    // is empty below. If the computer plays column 3 now, you win on top of it.
    const b = empty();
    [0, 1, 2, 3, 4, 5, 6].forEach((col) => (b[at(5, col)] = col % 2 ? 1 : 2));
    b[at(5, 3)] = 0;
    [0, 1, 2].forEach((col) => (b[at(4, col)] = 1));
    // Column 3: bottom is free. A computer disc there lets you complete row 4.
    const move = chooseMove(b, 2, 4, 0, createRng(1));
    expect(move).not.toBe(3);
  });
});
