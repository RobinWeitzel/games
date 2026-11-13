import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { generate, geometry, isValidSolution, solve } from './engine';
import { CROSS, EMPTY, LINE, SlitherlinkGame, branches, clueStates, hasClosedLoop, newGame, progress, reduce, restart } from './state';

/** The loop around a set of cells (row-major indices) of an n × n grid. */
function outline(n: number, inside: number[]): boolean[] {
  const geo = geometry(n);
  const set = new Set(inside);
  return geo.edgeCells.map((cells) => cells.filter((c) => set.has(c)).length === 1);
}
const cluesOf = (n: number, on: boolean[]) => geometry(n).cellEdges.map((es) => es.filter((e) => on[e]).length);

describe('engine', () => {
  it('knows the edges of cells and dots', () => {
    const geo = geometry(2);
    expect(geo.edges).toBe(12);
    expect(geo.cellEdges[0]).toEqual([0, 2, 6, 7]); // top, bottom, left, right
    expect(geo.dotEdges[4]).toHaveLength(4); // the middle dot
    expect(geo.dotEdges[0]).toHaveLength(2); // a corner
  });

  it('checks for one loop that fits the numbers', () => {
    const one = outline(3, [0, 1, 4]);
    expect(isValidSolution(3, cluesOf(3, one), one)).toBe(true);
    // Two separate loops.
    const two = outline(3, [0, 8]);
    expect(isValidSolution(3, cluesOf(3, two), two)).toBe(false);
  });

  it('solves with all numbers and sees a second solution with none', () => {
    const loop = outline(3, [0, 1, 4]);
    expect(solve(3, cluesOf(3, loop), 3)).toEqual([loop]);
    expect(solve(3, new Array(9).fill(-1), 2)).toHaveLength(2);
  });

  it('generates puzzles with one solution', () => {
    for (const d of ['easy', 'medium'] as const) {
      const p = generate(d, createRng(2));
      expect(isValidSolution(p.n, p.clues, p.solution)).toBe(true);
      expect(solve(p.n, p.clues, 2, 100000)).toEqual([p.solution]);
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate('medium', createRng(5))).toEqual(generate('medium', createRng(5)));
  });
});

describe('game', () => {
  const loop = outline(3, [0, 1, 4]);
  const fresh = (): SlitherlinkGame => newGame({ mode: 'easy', difficulty: 'easy', n: 3, clues: cluesOf(3, loop), solution: loop });

  it('a tap cycles empty → line → cross → empty', () => {
    let g = fresh();
    [g] = reduce(g, { type: 'tap', edge: 0 });
    expect(g.edges[0]).toBe(LINE);
    [g] = reduce(g, { type: 'tap', edge: 0 });
    expect(g.edges[0]).toBe(CROSS);
    [g] = reduce(g, { type: 'tap', edge: 0 });
    expect(g.edges[0]).toBe(EMPTY);
  });

  it('flags branches, wrong numbers and early loops', () => {
    let g = fresh();
    const geo = geometry(3);
    // Three lines at the dot between cells 0, 1, 3 and 4 (dot 5).
    let ev;
    [g, ev] = reduce(g, { type: 'paint', edges: geo.dotEdges[5].slice(0, 3), value: LINE });
    expect(branches(g).has(5)).toBe(true);
    expect(ev.kind === 'changed' && ev.mistake).toBe(true);
    [g] = reduce(g, { type: 'undo' });
    // The loop around cell 8 alone: closed, but not the solution; its number (0) is wrong too.
    [g] = reduce(g, { type: 'paint', edges: geo.cellEdges[8], value: LINE });
    expect(hasClosedLoop(g)).toBe(true);
    expect(clueStates(g).get(8)).toBe('bad');
  });

  it('drawing the loop wins', () => {
    const g = fresh();
    const edges = loop.map((on, e) => (on ? e : -1)).filter((e) => e >= 0);
    const [won, ev] = reduce(g, { type: 'paint', edges, value: LINE });
    expect(ev.kind).toBe('won');
    expect(progress(won)).toBe(1);
  });

  it('hints solve a generated puzzle, fixing wrong marks first', () => {
    const p = generate('easy', createRng(9));
    let g = newGame({ mode: 'easy', difficulty: 'easy', ...p });
    const off = p.solution.findIndex((s) => !s);
    [g] = reduce(g, { type: 'paint', edges: [off], value: LINE });
    let ev;
    [g, ev] = reduce(g, { type: 'hint' });
    expect(ev).toEqual({ kind: 'hint', edge: off });
    for (let k = 0; k < 80 && g.status === 'playing'; k++) [g, ev] = reduce(g, { type: 'hint' });
    expect(ev!.kind).toBe('won');
  });

  it('restart clears the board, keeps time and hints, and counts as an undo', () => {
    const g0 = fresh();
    expect(restart(g0)).toBe(g0);
    const g = { ...reduce(g0, { type: 'hint' })[0], elapsedMs: 5000 };
    expect(g.edges).not.toEqual(g0.edges);
    const r = restart(g);
    expect(r.edges).toEqual(g0.edges);
    expect(r).toMatchObject({ status: 'playing', history: [], hints: g.hints, undos: g.undos + 1, elapsedMs: 5000 });
    expect(restart(r)).toBe(r);
  });
});
