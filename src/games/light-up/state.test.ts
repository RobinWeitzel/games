import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { BLACK, WHITE, generate, solve } from './engine';
import { BULB, DOT, EMPTY, LightUpGame, clashes, litCells, newGame, numberStates, reduce } from './state';

/** A tiny puzzle from rows: '.' white, '#' black, digits numbered blacks. */
function puzzle(rows: string[]) {
  const n = rows.length;
  const cells = rows.join('').split('').map((ch) => (ch === '.' ? WHITE : ch === '#' ? BLACK : Number(ch)));
  return { n, cells };
}

describe('engine', () => {
  it('solves a small puzzle', () => {
    const { n, cells } = puzzle(['.1.', '...', '.#.']);
    const sols = solve(n, cells, 3);
    expect(sols.length).toBeGreaterThan(0);
    for (const s of sols) expect(s.filter((c) => [0, 2, 4].includes(c)).length).toBe(1);
  });

  it('generates puzzles with one solution', () => {
    for (const [n, d] of [
      [7, 'easy'],
      [10, 'hard'],
    ] as const) {
      const p = generate(n, d, createRng(n));
      expect(solve(n, p.cells, 2)).toEqual([p.solution]);
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate(10, 'medium', createRng(2))).toEqual(generate(10, 'medium', createRng(2)));
  });
});

describe('game', () => {
  const p = generate(7, 'easy', createRng(5));
  const fresh = (): LightUpGame => newGame({ mode: 'easy', difficulty: 'easy', ...p });
  const white = p.cells.findIndex((v) => v === WHITE);

  it('a tap cycles empty → bulb → dot → empty, and a bulb lights its row and column', () => {
    let g = fresh();
    [g] = reduce(g, { type: 'tap', cell: white });
    expect(g.marks[white]).toBe(BULB);
    expect(litCells(g).has(white)).toBe(true);
    [g] = reduce(g, { type: 'tap', cell: white });
    expect(g.marks[white]).toBe(DOT);
    [g] = reduce(g, { type: 'tap', cell: white });
    expect(g.marks[white]).toBe(EMPTY);
  });

  it('flags bulbs that light each other and numbers with too many bulbs', () => {
    const { n, cells } = puzzle(['...', '.0.', '...']);
    let g: LightUpGame = newGame({ mode: 'easy', difficulty: 'easy', n, cells, solution: [] });
    [g] = reduce(g, { type: 'tap', cell: 0 });
    [g] = reduce(g, { type: 'tap', cell: 2 });
    expect([...clashes(g)].sort()).toEqual([0, 2]);
    [g] = reduce(g, { type: 'tap', cell: 1 });
    expect(numberStates(g).get(4)).toBe('over');
  });

  it('hints solve the puzzle', () => {
    let g = fresh();
    let ev;
    for (let k = 0; k < 60 && g.status === 'playing'; k++) [g, ev] = reduce(g, { type: 'hint' });
    expect(ev!.kind).toBe('won');
  });

  it('undo takes back a drag of dots in one step', () => {
    const whites = p.cells.map((v, i) => (v === WHITE ? i : -1)).filter((i) => i >= 0).slice(0, 3);
    let g = reduce(fresh(), { type: 'dot', cells: whites })[0];
    expect(whites.every((c) => g.marks[c] === DOT)).toBe(true);
    [g] = reduce(g, { type: 'undo' });
    expect(g.marks.every((m) => m === EMPTY)).toBe(true);
  });
});
