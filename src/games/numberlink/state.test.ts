import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { generate, isChain } from './engine';
import { NumberlinkGame, extend, isJoined, newGame, reduce, startAt } from './state';

describe('engine', () => {
  it('covers the grid with paths of three or more cells', () => {
    for (const n of [5, 7, 9]) {
      const p = generate(n, createRng(n));
      const all = p.paths.flat();
      expect(all.length).toBe(n * n);
      expect(new Set(all).size).toBe(n * n);
      for (const path of p.paths) {
        expect(path.length).toBeGreaterThanOrEqual(3);
        expect(isChain(n, path)).toBe(true);
      }
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate(7, createRng(4))).toEqual(generate(7, createRng(4)));
  });
});

describe('drawing', () => {
  // 3 × 3: pair 0 from 0 to 2 along the top, pair 1 from 3 to 8 via 4 5 ... (any filling wins).
  const ends: [number, number][] = [
    [0, 2],
    [3, 8],
  ];
  const g0: NumberlinkGame = newGame({ mode: 'small', n: 3, ends, paths: [[0, 1, 2], [3, 6, 7, 4, 5, 8]] });

  it('draws from an endpoint, moves back to shorten, and joins at the other endpoint', () => {
    let s = startAt(3, ends, g0.paths, 0)!;
    let paths = extend(3, ends, s.paths, 0, 1)!;
    paths = extend(3, ends, paths, 0, 4)!;
    expect(paths[0]).toEqual([0, 1, 4]);
    paths = extend(3, ends, paths, 0, 1)!; // back
    expect(paths[0]).toEqual([0, 1]);
    paths = extend(3, ends, paths, 0, 2)!;
    expect(isJoined({ ends, paths }, 0)).toBe(true);
    // Joined: it can't go further.
    expect(extend(3, ends, paths, 0, 5)).toBeNull();
    // Another pair's endpoint blocks.
    s = startAt(3, ends, paths, 3)!;
    expect(extend(3, ends, s.paths, 1, 0)).toBeNull();
  });

  it('crossing another path cuts it', () => {
    let paths: number[][] = [[0, 1, 4, 5], []];
    paths = startAt(3, ends, paths, 3)!.paths;
    paths = extend(3, ends, paths, 1, 4)!;
    expect(paths[0]).toEqual([0, 1]);
    expect(paths[1]).toEqual([3, 4]);
  });

  it('wins when all pairs are joined and every cell is used', () => {
    const [g, ev] = reduce(g0, { type: 'commit', paths: [[0, 1, 2], [3, 4, 5, 8]] });
    expect(ev.kind).toBe('changed'); // 6 and 7 are empty
    const [won, ev2] = reduce(g, { type: 'commit', paths: [[0, 1, 2], [3, 6, 7, 4, 5, 8]] });
    expect(ev2.kind).toBe('won');
    expect(won.status).toBe('won');
  });

  it('hints lay solution paths until solved, and undo takes back a step', () => {
    const p = generate(7, createRng(9));
    let g = newGame({ mode: 'medium', ...p });
    let ev;
    for (let k = 0; k < p.ends.length + 1 && g.status === 'playing'; k++) [g, ev] = reduce(g, { type: 'hint' });
    expect(ev!.kind).toBe('won');
    const [one] = reduce(g0, { type: 'commit', paths: [[0, 1], []] });
    expect(reduce(one, { type: 'undo' })[0].paths).toEqual(g0.paths);
  });
});
