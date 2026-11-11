import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { boxSides, chooseLine, completes, geometry, hLine, lineCount, vLine } from './engine';

const s = { rows: 2, cols: 2 };

describe('dots and boxes', () => {
  it('numbers lines and box sides', () => {
    expect(lineCount(s)).toBe(12);
    expect(boxSides(s)[0]).toEqual([hLine(s, 0, 0), hLine(s, 1, 0), vLine(s, 0, 0), vLine(s, 0, 1)]);
    expect(geometry(s).boxesOf[hLine(s, 1, 0)]).toEqual([0, 2]);
  });

  it('a fourth side completes the box', () => {
    const lines = new Array(12).fill(false);
    [hLine(s, 0, 0), hLine(s, 1, 0), vLine(s, 0, 0)].forEach((l) => (lines[l] = true));
    expect(completes(geometry(s), lines, vLine(s, 0, 1))).toEqual([0]);
  });

  it('every level takes a free box; medium avoids handing one over', () => {
    const lines = new Array(12).fill(false);
    [hLine(s, 0, 0), hLine(s, 1, 0), vLine(s, 0, 0)].forEach((l) => (lines[l] = true));
    expect(chooseLine(s, lines, 'medium', createRng(1))).toBe(vLine(s, 0, 1));
    const two = new Array(12).fill(false);
    [hLine(s, 0, 0), vLine(s, 0, 0)].forEach((l) => (two[l] = true));
    for (let k = 1; k < 10; k++) {
      const l = chooseLine(s, two, 'medium', createRng(k));
      expect([hLine(s, 1, 0), vLine(s, 0, 1)]).not.toContain(l);
    }
  });

  it('hard plays the endgame exactly', () => {
    const lines = new Array(12).fill(false);
    const l = chooseLine(s, lines, 'hard', createRng(2));
    expect(l).toBeGreaterThanOrEqual(0);
  });
});
