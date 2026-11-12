import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { Island, countSolutions, crosses, findEdges, generate } from './engine';
import { BridgesGame, edgeFrom, isSolved, newGame, reduce } from './state';

/** A game from islands written as [row, col, n]. Solution: all zeros unless given. */
function game(w: number, h: number, list: [number, number, number][], solution?: number[]): BridgesGame {
  const islands: Island[] = list.map(([r, c, n]) => ({ r, c, n }));
  const edges = findEdges(w, h, islands);
  return newGame({ mode: 'easy', w, h, islands, edges, solution: solution ?? edges.map(() => 0) });
}

describe('engine', () => {
  it('finds the islands that see each other', () => {
    const g = game(5, 5, [
      [0, 0, 1],
      [0, 3, 1],
      [2, 0, 1],
    ]);
    expect(g.edges).toEqual([
      { a: 0, b: 1 },
      { a: 0, b: 2 },
    ]);
  });

  it('knows when bridges cross', () => {
    const isl: Island[] = [
      { r: 1, c: 0, n: 1 },
      { r: 1, c: 4, n: 1 },
      { r: 0, c: 2, n: 1 },
      { r: 3, c: 2, n: 1 },
    ];
    expect(crosses(isl, { a: 0, b: 1 }, { a: 2, b: 3 })).toBe(true);
    expect(crosses(isl, { a: 0, b: 1 }, { a: 0, b: 1 })).toBe(false);
  });

  it('counts solutions', () => {
    // A 2 and a 2 side by side: one way (a double bridge).
    expect(countSolutions(3, 1, [{ r: 0, c: 0, n: 2 }, { r: 0, c: 2, n: 2 }])).toBe(1);
    // Four 1s in a square: they can't all be connected.
    const square: Island[] = [
      { r: 0, c: 0, n: 1 },
      { r: 0, c: 2, n: 1 },
      { r: 2, c: 0, n: 1 },
      { r: 2, c: 2, n: 1 },
    ];
    expect(countSolutions(3, 3, square)).toBe(0);
    // Four 2s in a square: a ring, but also two double bridges… which aren't connected. One solution.
    expect(countSolutions(3, 3, square.map((i) => ({ ...i, n: 2 })))).toBe(1);
  });

  it('generates puzzles with one solution that the solution satisfies', () => {
    for (const n of [7, 9, 11]) {
      const p = generate(n, n, createRng(n));
      expect(countSolutions(n, n, p.islands)).toBe(1);
      const g = { ...newGame({ mode: 'easy', ...p }), bridges: p.solution };
      expect(isSolved(g)).toBe(true);
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate(9, 9, createRng(5))).toEqual(generate(9, 9, createRng(5)));
  });
});

describe('game', () => {
  it('cycles 0 → 1 → 2 → 0, limited by the island numbers', () => {
    let g = game(4, 1, [
      [0, 0, 2],
      [0, 3, 3],
    ]);
    const counts: number[] = [];
    for (let k = 0; k < 3; k++) {
      g = reduce(g, { type: 'cycle', edge: 0 })[0];
      counts.push(g.bridges[0]);
    }
    expect(counts).toEqual([1, 2, 0]);
    const one = game(4, 1, [
      [0, 0, 1],
      [0, 3, 3],
    ]);
    const once = reduce(one, { type: 'cycle', edge: 0 })[0];
    expect(reduce(once, { type: 'cycle', edge: 0 })[0].bridges[0]).toBe(0);
  });

  it('won’t build a bridge across another', () => {
    let g = game(5, 4, [
      [1, 0, 1],
      [1, 4, 1],
      [0, 2, 1],
      [3, 2, 1],
    ]);
    const h = g.edges.findIndex((e) => e.a === 1 || e.b === 1);
    const v = g.edges.findIndex((e) => g.islands[e.a].c === 2 && g.islands[e.b].c === 2);
    g = reduce(g, { type: 'cycle', edge: h })[0];
    expect(reduce(g, { type: 'cycle', edge: v })[1]).toMatchObject({ kind: 'invalid' });
  });

  it('finds the edge in a direction from an island', () => {
    const g = game(5, 5, [
      [0, 0, 1],
      [0, 3, 1],
      [2, 0, 1],
    ]);
    expect(edgeFrom(g, 0, 0, 1)).toBe(0);
    expect(edgeFrom(g, 0, 1, 0)).toBe(1);
    expect(edgeFrom(g, 0, -1, 0)).toBeNull();
  });

  it('wins when every island is complete and all are connected; hints lead there', () => {
    const p = generate(7, 7, createRng(11));
    let g = newGame({ mode: 'easy', ...p });
    let ev;
    for (let k = 0; k < 200 && g.status === 'playing'; k++) [g, ev] = reduce(g, { type: 'hint' });
    expect(ev!.kind).toBe('won');
    expect(g.bridges).toEqual(p.solution);
  });

  it('undo takes back a bridge', () => {
    const g = game(4, 1, [
      [0, 0, 2],
      [0, 3, 2],
    ]);
    const [one] = reduce(g, { type: 'cycle', edge: 0 });
    expect(reduce(one, { type: 'undo' })[0].bridges).toEqual([0]);
  });
});
